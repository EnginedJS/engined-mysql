const url = require('url');
const { Service } = require('engined');
const MySQLAgent = require('./lib/agent');

module.exports = (opts = {}) => class extends Service {

	constructor(context) {
		super(context);

		this.uri = opts.uri || null;
		this.agentName = opts.agentName || 'default';
		this.dbName = opts.database || null;
		this.schemaPath = opts.schemaPath || null;
		this.agent = null;
	}

	async start() {

		let database = this.getContext().get('MySQL');
		if (!database) {
			database = {};
			this.getContext().set('MySQL', database);
		}

		if (database[this.agentName]) {
			throw new Error('Failed to initialize agent.', this.agentName + ' agent exists already');
		}

		if (!this.uri) {
			throw new Error('Failed to initialize agent.', 'No specific URI');
		}

		if (!this.dbName) {
			let urlObj = url.parse(this.uri);
			if (urlObj.pathname === null || urlObj.pathname === '/')
				throw new Error('Failed to initialize agent.', 'No specific database');

			this.dbName = urlObj.pathname.replace('/', '');
		}

		// Connect to raw database
		let agent = this.agent = new MySQLAgent(this.getContext(), this.dbName, this.schemaPath);
		await agent.connect(this.uri);

		database[this.agentName] = agent;
	}

	async stop() {

		let database = this.getContext().get('MySQL');

		if (!database)
			return;

		if (!this.agent)
			return;

		this.agent.disconnect();

		delete database[this.agentName];
	}
}
