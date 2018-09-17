/**
 * created By:zstone
 * 
 */
//该文件为dao层basejs

const pool = require('../utils/utils').getPool();
const async = require('async');

class BaseDao {
    constructor(config) {
        //自动保存配置项
        this.__config = config;
    }
    //可以使用get来获取配置项
    get(key) {
        return this.__config[key]
    }
    //可以使用set来设置配置项
    set(key, value) {
        this.__config[key] = value
    }
    //增
    create(params, callback) {
        if (!params) {
            return callback(null, true);
        }
        pool.query(`insert into ${this.__config.tableName} set ?`, [params], (err, rows) => {
            callback(err, rows);
        });
    }
    //批量增
    battleCreate(params, callback) {
        if (!params) {
            return callback(null, true);
        }
        async.every(params, (param, cb) => {
            this.create(param, (err, rows) => {
                cb(err, rows);
            })
        }, (err, rs) => {
            callback(err, rs);
        })
    }
    //改
    updateById(params, id, callback) {
        if (!id || !params) {
            return callback(null, true);
        }
        pool.query(`update ${this.__config.tableName} set ? where id = ?`, [params, id], (err, rows) => {
            callback(err, rows);
        });
    }
    //批量改,根据id
    battleUpdateById(params, ids, callback) {
        if (!ids || ids.length < 1 || !params) {
            return callback(null, true);
        }
        async.every(ids, (id, cb) => {
            this.updateById(params, id, (err, rows) => {
                cb(err, rows);
            })
        }, (err, rs) => {
            callback(err, rs);
        })
    }
    //批量改,根据id
    battleUpdateByOthers(params, others, callback) {
        //others:[{a:1,b:2}]
        if (!others || others.length < 1 || !params) {
            return callback(null, true);
        }
        async.every(others, (other, cb) => {
            this.updateByOthers(other, params, (err, rows) => {
                cb(err, rows);
            })
        }, (err, rs) => {
            callback(err, rs);
        })
    }
    //查
    queryAll(callback) {
        pool.query(`select * from ${this.__config.tableName}`, (err, rows) => {
            callback(err, rows);
        });
    }
    //根据id查
    queryById(id, callback) {
        if (!id) {
            return callback(null, true);
        }
        pool.query(`select * from ${this.__config.tableName} where id = ?`, [id], (err, rows) => {
            callback(err, rows);
        });
    }
    //批量查
    battleQueryById(ids, callback) {
        if (!ids || ids.length < 1) {
            return callback(null, true);
        }
        let results = [];
        async.each(ids, (id, cb) => {
            this.queryById(id, (err, rows) => {
                results.push(rows[0]);
                cb(err, rows);
            })
        }, (err, rs) => {
            callback(err, results);
        })
    }
    //删
    deleteById(id, callback) {
        if (!id) {
            return callback(null, true);
        }
        pool.query(`delete from ${this.__config.tableName} where id = ?`, [id], (err, rows) => {
            callback(err, rows);
        });
    }
    //批量删
    battleDeleteById(ids, callback) {
        if (!ids || ids.length < 1) {
            return callback(null, true);
        }
        async.every(ids, (id, cb) => {
            this.deleteById(id, (err, rows) => {
                cb(err, rows);
            })
        }, (err, rs) => {
            callback(err, rs);
        })
    }
    //根据其他字段改
    updateByOther(params, other, callback) {
        if (!other || !other.key || !params) {
            return callback(null, true);
        }
        //{ key: 'objectId', value: '5982890d2f301e0058d791c2' }
        pool.query(`update ${this.__config.tableName} set ? where ${other.key} = ?`, [params, other.value], (err, rows) => {
            callback(err, rows);
        });
    }
    //根据其他多个字段update
    updateByOthers(others, param, callback) {
        //others:{key1:value1,key2:value2}
        if (!others || others.length < 1 || !param) {
            return callback(null, true);
        }
        let sql = `update ${this.__config.tableName} set ? where 1=1 and`;
        Object.keys(others).map((key, index) => {
            if (index != Object.keys(others).length - 1) {
                sql += ` ${key}=${others[key]} and`
            } else {
                sql += ` ${key}=${others[key]}`
            }
        });
        pool.query(`${sql}`, [param], (err, rows) => {
            callback(err, rows);
        });
    }
    //根据其他字段查
    queryByOther(other, callback) {
        if (!other || !other.key) {
            return callback(null, true);
        }
        //{ key: 'objectId', value: '5982890d2f301e0058d791c2' }
        pool.query(`select * from ${this.__config.tableName} where ${other.key} = ?`, [other.value], (err, rows) => {
            callback(err, rows);
        });
    }
    //根据其他多个字段查
    queryByOthers(others, callback) {
        //others:{key1:value1,key2:value2}
        if (!others || others.length < 1) {
            return callback(null, true);
        }
        let sql = `select * from ${this.__config.tableName}  where 1 = 1 and`;
        Object.keys(others).map((key, index) => {
            if (index != Object.keys(others).length - 1) {
                sql += ` ${key}=${others[key]} and`
            } else {
                sql += ` ${key}=${others[key]}`
            }
        });
        pool.query(`${sql}`, (err, rows) => {
            callback(err, rows);
        });
    }
    //根据其他多个字段查,带分页 return:Object{list:Array[],count:number}
    queryByOthersPage(others, start = 0, limit = 10, callback) {
        //others:{key1:value1,key2:value2}
        if (!others || others.length < 1) {
            return callback(null, true);
        }
        let sql1 = `select * from ${this.__config.tableName}  where 1 = 1 and`;
        let sql2 = `select count(1) count from ${this.__config.tableName}  where 1 = 1 and`;
        Object.keys(others).map((key, index) => {
            if (index != Object.keys(others).length - 1) {
                sql1 += ` ${key}=${others[key]} and`
                sql2 += ` ${key}=${others[key]} and`
            } else {
                sql1 += ` ${key}=${others[key]}`
                sql2 += ` ${key}=${others[key]}`
            }
        });
        async.parallel({
            list: (cb) => {
                pool.query(`${sql1} limit ${start},${limit}`, (err, rows) => {
                    cb(err, rows);
                });
            },
            count: (cb) => {
                pool.query(`${sql2}`, (err, rows) => {
                    cb(err, rows[0].count);
                });
            }
        }, (err, results) => {
            callback(err, results);
        })
    }
    //根据其他字段删
    deleteByOther(other, callback) {
        if (!other || !other.key) {
            return callback(null, true);
        }
        //{ key: 'objectId', value: '5982890d2f301e0058d791c2' }
        pool.query(`delete from ${this.__config.tableName} where ${other.key} = ?`, [other.value], (err, rows) => {
            callback(err, rows);
        });
    }
}
Object.freeze(BaseDao);
module.exports = {
    BaseDao: BaseDao
}
