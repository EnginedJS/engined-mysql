# engined-mysql

MySQL agent service for engined, which is based on node-mysql2.

[![NPM](https://nodei.co/npm/engined-mysql.png)](https://nodei.co/npm/engined-mysql/)

## Installation

Install via NPM:

```shell
npm install engined-mysql
```

## Usage

start mysql agent service in engined, see example below:

```javascript
const { Manager } = require('engined');
const MySQLService = require('engined-mysql');

const MySQLDB = MySQLService({
	agentName: 'MyDB', // optional: default to 'default' if not set
	uri: 'mysql://localhost:3306/mydb'
});

const main = async () => {

	// Create manager
	let serviceManager = new Manager({ verbose: true });

	// Adding agent to manager
	serviceManager.add('MySQLDB', MySQLDB);

	// Start all services
	await serviceManager.startAll();
};

main();
```

## Access MySQL Database

Pretty easy to get agent from context query database by node-mysql way.

```javascript
let agent = this.getContext('MySQL')['MyMongoDB'];

// Querying
let ret = await agent.query('SELECT * FROM `mytable` WHERE `id` = ?', [ 1 ]);
```

## License
Licensed under the MIT License
 
## Authors
Copyright(c) 2017 Fred Chien（錢逢祥） <<cfsghost@gmail.com>>
