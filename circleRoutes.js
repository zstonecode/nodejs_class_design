const express = require('express');
const router = express.Router();
const _ = require('lodash');
const xss = require('xss');
const moment = require('moment')
const md5 = require("blueimp-md5");
const utils = require('../utils/utils');
const errcode = require('../utils/errcode');
const pool = utils.getPool();
const circleActivityMiddleWare = require('../circleMiddleWare/circleActivityMiddleWare');

const fs = require('fs');
const path = require('path');

router.use(circleActivityMiddleWare.circleUserActivity);

let files = fs.readdirSync(path.resolve(__dirname, '../circleController'))//`${__dirname}/circleController`);
let js_files = files.filter((f) => {
    return f.endsWith('.js');
});

let controllerPath = path.resolve(__dirname, '../circleController');
for (let f of js_files) {
    console.log(`process controller:${f}.....`);
    //导入js文件
    let mapping = require(controllerPath + '/' + f);
    for (let url in mapping) {
        if (url.startsWith('GET')) {
            //如果url类似“GET XXX”
            let path = url.substring(4);
            router.get(path, mapping[url]);
            console.log(`register URL mapping : GET ${path}`);
        } else if (url.startsWith('POST')) {
            //如果url类似“POST XXX”
            let path = url.substring(5);
            router.post(path, mapping[url]);
            console.log(`register URL mapping : POST ${path}`);
        } else if (url.startsWith('OPTIONS')) {
            //如果url类似“OPTIONS XXX”
            let path = url.substring(8);
            router.options(path, mapping[url]);
            console.log(`register URL mapping : OPTIONS ${path}`);
        } else {
            //无效的URL
            console.log(`invalid URL：${url}`);
        }
    }
}

module.exports = router;
