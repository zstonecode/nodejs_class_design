/**
 * created By:zstone
 * 
 */
const { BaseDao } = require('../dao/base_dao');
const async = require('async');
const pool = require('../utils/utils').getPool();
const _ = require('lodash');

class USerDao extends BaseDao {
    constructor(config) {
        super(config);
    }
    //extraFunc here
    
};
const USerDaoProxy = new Proxy(new USerDao({ tableName: "user" }), {
    get: function (target, key, receiver) {
        if (key in target) {
            return Reflect.get(target, key, receiver);
        } else {
            console.error("Property \"" + key + "\" does not exist.");
            throw new ReferenceError("Property \"" + key + "\" does not exist.");
        }
    },
    set: function (target, key, value, receiver) {
        console.log(`setting ${key}!`);
        return Reflect.set(target, key, value, receiver);
    },
    apply: function (target, thisBinding, args) {
        console.log(`apply ${thisBinding}!`);
        return Reflect.apply(target, thisBinding, args);
    }
});
Object.freeze(USerDaoProxy);
module.exports = USerDaoProxy;
