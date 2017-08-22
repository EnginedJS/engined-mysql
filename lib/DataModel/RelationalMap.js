class ViewManager {

	constructor(relationalMap) {
		this.relationalMap = relationalMap;
		this.views = {};
	}

	createView(name, viewInfo) {

		let view = {
			name: name,
			relatedTables: viewInfo.relatedTables,
			def: viewInfo.def,
			getRelatedTables: () => {
				return view.relatedTables;
			},
			prepareTables: () => {
				return view.relatedTables.join(', ');
			},
			getFields: () => {
				return view.def;
			},
			getFieldNames: () => {
				return Object.keys(view.def);
			},
			prepareColumns: () => {
				return Object.entries(view.getFields()).map(([ viewFieldName, field ]) => {
					return field.def.tableName + '.' + field.def.name + ' as ' + viewFieldName;
				});
			},
			getColumnName(fieldName) {
				let field = view.getFields()[fieldName];
				return field.def.tableName + '.' + field.def.name + ' as ' + viewFieldName;
			},
			getFieldRules: () => {
				return Object
					.entries(view.getFields())
					.reduce((fieldRules, [ viewFieldName, field ]) => {
						fieldRules[viewFieldName] = field.def.rule;
						return fieldRules;
					}, {});
			}
		};

		return view;
	}

	applySchema(viewSchema) {

		this.views = Object
			.entries(viewSchema)
			.map(([ viewName, viewDefine ]) => {

				let viewInfo = this.parseViewDefine(viewDefine);

				return this.createView(viewName, viewInfo);
			})
			.reduce((views, view) => {
				views[view.name] = view;
				return views;
			}, {});

		return this.views;
	}

	parseViewDefine(viewDefine) {

		let relatedTables = [];

		let viewDef = Object
			.entries(viewDefine.schema)
			.map(([ viewFieldName, target ]) => {
				let [ tableName, fieldName ] = target.split('.');

				// Store such table in related table list
				if (relatedTables.indexOf(tableName) === -1)
					relatedTables.push(tableName);

				try {

					// Prepare definition of field
					return {
						viewFieldName: viewFieldName,
						def: this.relationalMap.database.table(tableName).field(fieldName)
					};

				} catch(e) {
					throw new Error('No such database definition \"' + target + '\".');
				}
			})
			.reduce((fields, fieldInfo) => {
				fields[fieldInfo.viewFieldName] = fieldInfo;
				return fields;
			}, {});

		return {
			relatedTables: relatedTables,
			def: viewDef
		};
	}

	getView(viewName) {
		return this.views[viewName];
	}

	getRelatedTables(view) {
		return view.relatedTables;
	}
}

class RelationalMap {

	constructor() {
		this.viewManager = new ViewManager(this);
		this.database = {};
		this.views = {};
	}

	applyDbSchema(schema) {
		this.database = this.dbSchema(schema);
	}

	applyViewSchema(viewSchema) {
		this.viewManager.applySchema(viewSchema);
	}

	getView(viewName) {
		return this.viewManager.getView(viewName);
	}

	field(tableName, name, def) {
		return {
			tableName: tableName,
			name: name,
			rule: def
		};
	}

	tableSchema(tableName, ref) {

		const table = {
			tableName: tableName,
			field: (fieldName) => {
				let field = table.fields[fieldName];
				if (field === undefined)
					throw new Error('No such field \"' + fieldName + '\"');

				return field;
			},
			fields: {}
		};

		table.fields = Object.entries(ref).reduce((fields, [ fieldName, def ]) => {

			fields[fieldName] = this.field(tableName, fieldName, def);

			return fields;
		}, {});

		return table;
	}

	dbSchema(ref) {

		const db = {
			table: (tableName) => {
				let table = db.tables[tableName];
				if (table === undefined)
					throw new Error('No such field \"' + tableName + '\"');

				return table;
			},
			tables: {}
		};

		db.tables = Object.entries(ref).reduce((tables, [ tableName, def ]) => {

			tables[tableName] = this.tableSchema(tableName, def);

			return tables;
		}, {});

		return db;
	}
};

module.exports = RelationalMap;
