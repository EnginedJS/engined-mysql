const ModelManager = require('./DataModel/ModelManager');

module.exports = class {

	constructor(dbAgent) {
		this.dbAgent = dbAgent;
	}

	async prepareIndexActions(tableName, schema) {

		// Getting indexes information from database
		let [ indexRecords ] = await this.dbAgent.query('SELECT * FROM information_schema.STATISTICS WHERE TABLE_NAME = ?', [ tableName ]);

		let indexesInfo = indexRecords
			.map((record) => {

				return {
					name: record.INDEX_NAME,
					column: record.COLUMN_NAME
				};
			})
			.reduce((indexes, info) => {

				// Grouping index
				let index = indexes[info.name];
				if (index === undefined) {
					index = indexes[info.name] = {
						name: info.name,
						columns: []
					};
				}

				index.columns.push(info.column);

				return indexes;
			}, {});

		// Find out what index we need to create
		let creationActions = Object.entries(schema.indexes || {})
			.map(([ indexName, def ]) => {

				// Check specified columns whether exists or not
				Object.values(def.columns).find((columnName) => {
					if (Object.keys(schema.columns).indexOf(columnName) === -1)
						throw new Error('Cannot create index because no such ' + columnName + ' column in table');
				});

				// Index doesn't exist in database
				if (indexesInfo[indexName] === undefined) {
					return {
						action: 'create',
						indexName: indexName
					};
				}

				return null;
			})
			.filter((newIndex) => {
				return (newIndex !== null);
			});

		// Finding what index we need to update
		let updateActions = Object.values(indexesInfo)
			.map((info) => {

				// Remove all indexes
				if (schema.indexes === undefined) {
					return {
						action: 'remove',
						indexName: info.name
					};
				}

				let index = schema.indexes[info.name];

				// This index should be removed
				if (index === undefined) {
					return {
						action: 'remove',
						indexName: info.name
					}
				}

				// No need to do anything for this index
				if (index.type === 'primary' &&
					info.name === 'PRIMARY' &&
					index.columns.length === info.columns.length &&
					index.columns[0] === info.columns[0]) {
					return null;
				}

				// Require to re-create index
				if (index.columns.length != info.columns.length) {
					return {
						action: 'rebuild',
						indexName: info.name
					}
				}

				// The rest of index which is required to re-build because definition was changed
				let requiredToRebuild = index.columns
					.map((columnName) => {

						if (info.columns.indexOf(columnName) === -1) {
							return true;
						}

						return false;
					})
					.reduce((ret, isRequired) => {
						return (ret === false) ? isRequired : ret;
					}, false);

				if (requiredToRebuild) {
					return {
						action: 'rebuild',
						indexName: info.name
					}
				}

				return null;
			})
			.filter((actions) => {
				return (actions !== null);
			});

		// Merge actions
		let actions = creationActions.concat(updateActions);

		// Generate SQL
		let sql = actions.map((action) => {

			if (action.action === 'remove') {
				return [
					'DROP INDEX',
					'`' + action.indexName + '`',
					'ON',
					'`' + tableName + '`'
				].join(' ');
			}

			// Getting index definition
			let index = schema.indexes[action.indexName];
			let type = 'INDEX';
			if (index.type === 'primary') {
				type = 'PRIMARY';
			} else if (index.type === 'unique') {
				type = 'UNIQUE';
			}

			if (action.action === 'rebuild') {
				return [
					'DROP INDEX',
					'`' + action.indexName + '`',
					'ON',
					'`' + tableName + '`;',
					'ALTER TABLE',
					'`' + tableName + '`',
					'ADD',
					type,
					'`' + action.indexName + '`',
					'(' + index.columns.join(',') + ')'
				].join(' ');
			}

			if (action.action === 'create') {
				return [
					'ALTER TABLE',
					'`' + tableName + '`',
					'ADD',
					type,
					'`' + action.indexName + '`',
					'(' + index.columns.join(',') + ')'
				].join(' ');
			}
		});

		if (sql.length === 0)
			return null;

		return sql.join(';');
	}

	async prepareTableUpdateActions(tableName, existedColumns, schema) {

		// Check all columns
		const columns = Object.keys(schema.columns);

		// Compare database with column schema to get non-existed columns
		let newColumns = columns.filter((columnName) => {
			let found = existedColumns.find((existedColumn) => {
				return (existedColumn.name === columnName);
			});

			return (!found);
		});

		// Getting columns that are going to be removed
		let removedColumns = existedColumns
			.filter(column => (columns.indexOf(column.name) === -1))
			.map(column => column.name);
/*
		console.log('REMOVE', removedColumns);
		console.log('NEW', newColumns);
*/
		let removalActions = removedColumns.map((name) => {
			return [
				'ALTER TABLE',
				'`' + tableName + '`',
				'DROP COLUMN',
				'`' + name + '`'
			].join(' ');
		});

		let creationActions = newColumns.map((name) => {
			return [
				'ALTER TABLE',
				'`' + tableName + '`',
				'ADD COLUMN',
				'`' + name + '`',
				manager.generateColumnSQL(tableName, name)
			].join(' ');
		});

		// Preparing index actions
		let indexActions = await this.prepareIndexActions(tableName, schema);

		return removalActions.concat(creationActions, indexActions || []).join(';');
	}

	async prepareTableActions(models) {

		const manager = new ModelManager(models);

		// Initializing columns
		let initTasks = Object
			.entries(models)
			.map(async ([ tableName, schema ]) => {

				// Getting specific table information
				let [ records ] = await this.dbAgent.query('SELECT * FROM information_schema.COLUMNS WHERE TABLE_NAME = ?', [ tableName ]);

				// No such table
				if (records.length === 0) {

					// We create it right now
					return manager.generateTableSQL(tableName);
				}

				// Prepare data structure for columns existed
				let existedColumns = records
					.map((record) => {
						let lengthResult = record.COLUMN_TYPE.match(/[^\(]+(?=\))/g);

						return {
							name: record.COLUMN_NAME,
							dataType: record.DATA_TYPE,
							type: record.COLUMN_TYPE,
							length: lengthResult ? parseInt(lengthResult[0]) : null,
							default: record.COLUMN_DEFAULT
						}
					});

				return await this.prepareTableUpdateActions(tableName, existedColumns, schema);
			});

		let actions = await Promise.all(initTasks);

		// Filter out actions which is null
		actions = actions.filter((tableAction) => {
			return (tableAction);
		});

		return (actions.length === 0) ? null : actions.join('\n');
	}
};
