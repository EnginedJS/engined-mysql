
module.exports = class {

	constructor() {
	}

	parepareColumnDef(def) {

		const info = {
			originalType: def._type,
			length: -1	
		};

		// Resolve rules
		def._tests.reduce((info, test) => {
			if (test.name === 'max') {
				info.max = test.arg;
			} else if (test.name === 'min') {
				info.max = test.arg;
			} else if (test.name === 'length') {
				info.length = test.arg;
			} else if (test.name === 'integer') {
				info.integer = true;
			} else if (test.name === 'positive') {
				info.unsigned = true;
			}

			return info;
		}, info);

		// Default value
		if (def._flags.default !== undefined) {
			info.default = def._flags.default;
		}

		// Not Null
		if (def._flags.presence === 'required') {
			info.required = true;
		}

		// Determine type of column
		switch(def._type) {
		case 'string':

			if (info.max !== undefined) {
				info.length = info.max;
			}

			if (info.length == -1) {
				info.type = 'TEXT';
			} else {
				info.type = 'VARCHAR';

				if (info.required && info.default === undefined) {
					info.default = '';
				}
			}

			break;
		case 'number':
			if (info.integer) {

				if (info.max !== undefined) {
					if (info.unsigned) {
						info.max = 4294967295;
					} else {
						info.max = 2147683647;
					}
				}

				if (info.min !== undefined) {
					if (info.unsigned) {
						info.min = 0;
					} else {
						info.min = -2147683648;
					}
				}

				if (info.unsigned) {
					if (info.max <= 255) {
						info.length = 4;
					} else if (info.max <= 65535) {
						info.length = 6;
					} else if (info.max <= 16777215) {
						info.length = 9;
					} else if (info.max <= 4294967295) {
						info.length = 11;
					} else {
						info.length = 20;
					}
				} else {
					if (info.min >= -128 && info.max <= 127) {
						info.length = 4;
					} else if (info.min >= -32768 && info.max <= 32767) {
						info.length = 6;
					} else if (info.min >= -8388608 && info.max <= 8388607) {
						info.length = 9;
					} else if (info.min >= -2147683648 && info.max <= 2147683647) {
						info.length = 11;
					} else {
						info.length = 20;
					}
				}

				if (info.length === -1) {
					info.type = 'INT';
					info.length = 11;
				} else if (info.length > 0 && info.length <= 4) {
					info.type = 'TINYINT';
				} else if (info.length > 4 && info.length <= 6) {
					info.type = 'SMALLINT';
				} else if (info.length > 6 && info.length <= 9) {
					info.type = 'MEDIUMINT';
				} else if (info.length > 9 && info.length <= 11) {
					info.type = 'INT';
				} else if (info.length > 11) {
					info.type = 'BIGINT';
				}
			} else {
				info.type = 'DOUBLE';
			}
			break;
		case 'date':
			info.type = 'DATETIME';
			break;
		}

		return info;
	}

	prepareColumnsInfo(columns) {

		return Object.entries(columns).reduce((result, [ column, def ]) => {

			result[column] = this.parepareColumnDef(def);

			return result;
		}, {});
	}

	prepareParameterInfo(parameters) {

		// Parameters
		let params = Object.entries(parameters || {}).reduce((params, [ paramName, value ]) => {
			params[paramName] = value;
			return params;
		}, {});

		return Object.assign({
			ENGINE: 'InnoDB'
		}, params);
	}

	generateIndexSQL(columnInfo, indexSchema) {

		// Indexes
		let index = Object.entries(indexSchema || {}).reduce((result, [ indexName, def ]) => {

			let columns = def.columns.map((columnName) => {
				return '`' + columnName + '`';
			});

			if (def.type === 'primary') {
				result.primary = true;
				result.indexes.push('PRIMARY KEY (' + def.columns.join(',') + ')');
			} else if (def.type === 'unique') {
				result.indexes.push('UNIQUE KEY `' + indexName + '` (' + columns.join(',') + ')');
			} else {
				result.indexes.push('KEY `' + indexName + '` (' + columns.join(',') + ')');
			}

			return result;
		}, {
			indexes: [],
			primary: false
		});

		// No primary was set
		if (index.primary === false && columnInfo.id !== undefined) {
			index.indexes.unshift('PRIMARY KEY (`id`)');
		}

		return index.indexes;
	}

	generateColumnSQL(info) {

		const definition = [];

		if (info.length !== -1) {
			definition.push(info.type + '(' + info.length + ')');
		} else {
			definition.push(info.type);
		}

		if (info.unsigned) {
			definition.push('unsigned');
		}

		if (info.required) {
			definition.push('NOT NULL');
		}

		if (info.default !== undefined) {
			if (info.originalType !== 'number' && info.default !== 'AUTO_INCREMENT') {
				definition.push('DEFAULT');
			}

			if (info.originalType === 'string') {
				definition.push('"' + info.default + '"');

			} else {
				definition.push(info.default);
			}
		}

		return definition.join(' ');
	}

	generateColumnsSQL(columnInfo) {

		// Generate SQL lines
		return Object.entries(columnInfo).map(([ columnName, info ]) => {

			const definition = [
				'`' + columnName + '`'
			];

			const def = this.generateColumnSQL(info);

			return definition.concat(def).join(' ');
		});
	}

	generateTableSQL(tableName, columnInfo, indexInfo, parameterInfo) {

		let columnSQL = this.generateColumnsSQL(columnInfo);
		let indexSQL = this.generateIndexSQL(columnInfo, indexInfo);

		return [
			'CREATE TABLE',
			'`' + tableName + '`',
			'(\n',
			columnSQL.concat(indexSQL).join(', \n'),
			')',
			(parameterInfo['ENGINE'] ? 'ENGINE=' + parameterInfo['ENGINE'] : '') + ' DEFAULT CHARSET=utf8mb4;'
		].join(' ');
	}
};
