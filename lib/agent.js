const mysql = require('mysql2/promise');
const ModelManager = require('./DataModel/ModelManager');
const DbInitializer = require('./db_initializer');

module.exports = class MySQLAgent {

	constructor(ctx, dbName) {

		this.dbName = dbName;
		this.uri = null;
		this.pool = null;
		this.cache = {};
		this.dbInitializer = new DbInitializer(this);
	}

	async getConnection() {

		if (!this.pool)
			await this._connect();

		let connection = await this.pool.getConnection();

		return connection;
	}

	async _connect() {
		this.pool = await mysql.createPool(this.uri);
	}

	async connect(uri) {
		this.uri = uri;

		await this._connect();
	}

	async disconnect() {

		if (!this.pool)
			return;

		await this.pool.end();
	}

	async query(str, data) {

		let connection = await this.getConnection();

		let ret = await connection.query(str, data);

		connection.release();

		return ret;
	}

	async assertModels(models) {

		const tableActions = await this.dbInitializer.prepareTableActions(models);

		// Execute
		for (let index in tableActions) {
			let actions = tableActions[index];
			for (let index in actions) {
				await this.query(actions[index]);
			}
		}
	}
};
