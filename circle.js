/**
 * created By:zstone
 * 圈子
 */


const _ = require('lodash');
const circleService = require('../circleService/circleService');
const circleTagService = require('../circleService/circleTagService');
const utils = require('../utils/utils');
const errcode = require('../utils/errcode');



//1:添加circle
let addCircle = (req, res, next) => {
    
}



module.exports = {
    'POST /addCircle': addCircle,    
    'GET /circleList': circleList
}
