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

	async queryStream(str, data) {

		let connection = await this.getConnection();

		let ret;

		try {
			// Using raw connection to get raw query object for stream
			ret = connection.connection.query(str, data).stream();
			ret.on('finish', () => connection.release());
		} catch(e) {
			connection.release();
			throw e;
		}

		return ret;
	}

	async query(str, data) {

		let connection = await this.getConnection();

		let ret;

		try {
			ret = await connection.query(str, data);
		} catch(e) {
			connection.release();
			throw e;
		}

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
