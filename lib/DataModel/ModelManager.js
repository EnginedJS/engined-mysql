const SQLGenerator = require('./SQLGenerator');

module.exports = class {

	constructor(models) {

		this.models = models || {};
	}

	define(models) {
		this.models = models || {};
	}

	getModels() {
		return this.models;
	}

	getModel(modelName) {
		return this.models[modelName];
	};

	setModel(modelName, schema) {
		this.models[modelName] = schema;
	};

	updateModel(modelName, schema) {

		// Getting specific model
		const model = this.getModel(modelName);
		if (model === undefined)
			throw new Error('No such data model \"' + modelName + '\"');

		// Update than replace old one
		this.setModel(Object.assign(model, schema));
	}

	generateColumnSQL(tableName, columnName) {

		const sqlGenerator = new SQLGenerator();

		const schema = this.getModel(tableName);

		if (schema === undefined)
			throw new Error('No such model');

		const columnInfo = schema.columns[columnName];

		if (columnInfo === undefined)
			throw new Error('No such column');

		const info = sqlGenerator.parepareColumnDef(columnInfo);

		return sqlGenerator.generateColumnSQL(info);
	}

	generateTableSQL(tableName) {

		const sqlGenerator = new SQLGenerator();

		const schema = this.getModel(tableName);

		if (schema === undefined)
			throw new Error('No such model');

		// Getting columns and parameter information
		const columnInfo = sqlGenerator.prepareColumnsInfo(schema.columns);
		const parameterInfo = sqlGenerator.prepareParameterInfo(schema.parameters);

		// Generate SQL
		return sqlGenerator.generateTableSQL(tableName, columnInfo, schema.indexes, parameterInfo);
	}

	generateAllTableSQL() {

		const sqlGenerator = new SQLGenerator();

		// Prepare SQL commands for each table
		return Object.entries(this.getModels()).reduce((tables, [ tableName, schema ]) => {

			// Getting columns and parameter information
			const columnsInfo = sqlGenerator.prepareColumnsInfo(schema.columns);
			const parameterInfo = sqlGenerator.prepareParameterInfo(schema.parameters);

			// Generate SQL
			tables[tableName] = sqlGenerator.generateTableSQL(tableName, columnsInfo, schema.indexes, parameterInfo);

			return tables
		}, {});
	}
};
