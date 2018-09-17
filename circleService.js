/**
 * created By:zstone
 * 圈子service
 */
const async = require('async');
const _ = require('lodash');
const circleDao = require('../circleDao/circleDao');
const circleTagDao = require('../circleDao/circleTagDao');
const circleUserMidDao = require('../circleDao/circleUserMidDao');
const circleArticleDao = require('../circleDao/circleArticleDao');
const circleCommentDao = require('../circleDao/circleCommentDao');
const circleVideoDao = require('../circleDao/circleVideoDao');
const circleVideoTagDao = require('../circleDao/circleVideoTagDao');
const circleTopicDao = require('../circleDao/circleTopicDao');
const circleTopicReplyDao = require('../circleDao/circleTopicReplyDao');
const circleTopicReplyUpdownLogDao = require('../circleDao/circleTopicReplyUpdownLogDao');
const circleArticleOperateLogDao = require('../circleDao/circleArticleOperateLogDao');
const circleTopicReplyOperateLogDao = require('../circleDao/circleTopicReplyOperateLogDao');
const circleRankArtificialDao = require('../circleDao/circleRankArtificialDao');
const sharePostDao = require('../circleDao/sharePostDao');
const userDao = require('../circleDao/userDao');
const circleMsgUserMidDao = require('../circleDao/circleMsgUserMidDao');
const circleMsgDao = require('../circleDao/circleMsgDao');
const utils = require('../utils/utils');

exports.createCircle = (param, cb) => {
    //param:'name', 'avator', 'des', 'map', 'tags', 'publisher'
    if (!param) {
        return cb(null, true);
    }
    async.waterfall([
        (callback) => {
            //1添加circle
            circleDao.create(_.pick(param, ['name', 'avatar', 'des', 'longitude', 'latitude', 'publisher', 'lang', 'address']), (err, rows) => {
                callback(err, rows.insertId);
            })
        },
        (id, callback) => {
            //4添加circle_rankArtificial(创建圈子后，排序权重默认为1)
            circleRankArtificialDao.create({ circleId: id, circleRankArtificial: 1 }, (err, rows) => {
                callback(err, id);
            });
        },
        (id, callback) => {
            //3添加circle_user_mid(创建圈子后，创建人是该圈子的第一个成员)
            circleUserMidDao.create({ userId: param.publisher, circleId: id, status: 1 }, (err, rows) => {
                callback(err, id);
            });
        },
        (id, callback) => {
            //2添加tags
            circleTagDao.battleCreate(param.tags.map(tag => { return { circleId: id, tagname: tag } }), (err, rows) => {
                callback(err, rows, id);
            });
        }
    ], (err, results, id) => {
        cb(err, results, id);
    });
}

exports.getCircleList = (id, start, limit, q, lang, searchType, cb) => {
    circleDao.getCircleList(id, start, limit, q, lang, searchType, (err, rs) => {
        cb(err, rs);
    });
}

exports.getCircleMap = (longitude, latitude, radius, cb) => {
    let { minLongitude, maxLongitude, minLatitude, maxLatitude } = utils.getRadius(longitude, latitude, radius);
    async.parallel({
        //1:super圈子
        superCircle: (callback) => {
            circleDao.queryByOther({ key: 'type', value: 1 }, (err, rows) => {
                callback(err, rows ? rows.filter(row => row.status == 1).map(row => {
                    row.longitude = (maxLongitude - minLongitude) * Math.random() + minLongitude;
                    row.latitude = (maxLatitude - minLatitude) * Math.random() + minLatitude;
                    return row;
                }) : rows);
            })
        },
        //2:置顶圈子
        recommendCircle: (callback) => {
            async.waterfall([
                (cb1) => {
                    //找到置顶圈子搜素的半径
                    circleDao.findRecommendRadius((err, rows) => {
                        cb1(err, rows);
                    })
                },
                (radius1, cb1) => {
                    let { minLongitude, maxLongitude, minLatitude, maxLatitude } = utils.getRadius(longitude, latitude, radius1);
                    let minLongitude1 = minLongitude;
                    let maxLongitude1 = maxLongitude;
                    let minLatitude1 = minLatitude;
                    let maxLatitude1 = maxLatitude;
                    circleDao.getCircleMap({ key: 'type', value: 2 }, minLongitude1, maxLongitude1, minLatitude1, maxLatitude1, (err, rows) => {
                        cb1(err, rows);
                    })
                }
            ], (err, rs) => {
                callback(err, rs.map(row => {
                    row.longitude = (maxLongitude - minLongitude) * Math.random() + minLongitude;
                    row.latitude = (maxLatitude - minLatitude) * Math.random() + minLatitude;
                    return row;
                }));
            });
        },
        //3:普通圈子
        commonCircle: (callback) => {
            circleDao.getCircleMap({ key: 'type', value: 3 }, minLongitude, maxLongitude, minLatitude, maxLatitude, (err, rs) => {
                callback(err, rs);
            });
        },
        //4:作品TODO
        sharePost: (callback) => {
            sharePostDao.getPostMap(minLongitude, maxLongitude, minLatitude, maxLatitude, (err, rows) => {
                callback(err, rows);
            });
        }
    }, (err, results) => {
        cb(err, results);
    });
}

exports.updateCircle = (param, id, cb) => {
    circleDao.updateById(param, id, (err, rs) => {
        cb(err, rs);
    });
}

exports.topicDetail = (id, userId, cb) => {
    async.parallel({
        basicInfo: (callback) => {
            async.waterfall([
                (cb1) => {
                    circleTopicDao.queryById(id, (err, rows) => {
                        cb1(err, rows);
                    });
                },
                (rows, cb1) => {
                    userDao.queryById(rows[0] ? rows[0].publisher : null, (err, rows1) => {
                        cb1(err, Object.assign(rows[0], { userAvatar: rows1[0] ? rows1[0].avatar : null, verified: rows1[0] ? rows1[0].verified : null, userNickname: rows1[0] ? rows1[0].nickname : null }));
                    });
                }
            ], (err, rs) => {
                callback(err, rs);
            });
        },
        replyInfo: (callback) => {
            async.waterfall([
                (callback1) => {
                    circleTopicReplyDao.queryByOthersWithNicknameAvaterVerified({ topicId: id, status: 1 }, (err, rows) => {
                        callback1(err, err, rows);
                    })
                },
                (err, rows, callback1) => {
                    if (!userId) {
                        callback1(err, rows.map(row => {
                            //没有传入token
                            return Object.assign(row, { canDel: row.publisher == userId ? 1 : 0, isUp: 0, isDown: 0 });
                        }));
                    } else {
                        //传入了token
                        async.every(rows, (row, callback2) => {
                            circleTopicReplyUpdownLogDao.queryByOthers({ userId, topicReplyId: row.id }, (err, rows5) => {
                                if (err) {
                                    return callback2(err, rows5);
                                }
                                if (!rows5 || rows5.length < 1) {
                                    //没有顶踩记录
                                    callback2(err, Object.assign(row, { canDel: row.publisher == userId ? 1 : 0, isUp: 0, isDown: 0 })); //isUp,isDown 0未顶踩1已顶踩
                                } else if (rows5[0].type == 1) {
                                    callback2(err, Object.assign(row, { canDel: row.publisher == userId ? 1 : 0, isUp: 1, isDown: 0 }));
                                } else if (rows5[0].type == 2) {
                                    callback2(err, Object.assign(row, { canDel: row.publisher == userId ? 1 : 0, isUp: 0, isDown: 1 }));
                                } else {
                                    callback2(err, Object.assign(row, { canDel: row.publisher == userId ? 1 : 0, isUp: 0, isDown: 0 }));
                                }
                            })
                        }, (err, rs2) => {
                            callback1(err, rows);
                        });
                    }
                }
            ], (err, rs) => {
                callback(err, rs);
            });
        }
    }, (err, results) => {
        cb(err, results);
    })
}

exports.updownTopicReply = (id, type, userId, cb) => {
    ***Dao.queryByOthers({ userId, topicReplyId: id }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (!rows || rows.length < 1) {
            //该用户没有进行顶踩操作
            switch (type) {
                case 2:
                    //踩
                    async.series([
                        (callback) => {
                            circleTopicReplyDao.addDownCnt(id, (err, rs) => {
                                callback(err, rs);
                            })
                        },
                        (callback) => {
                            circleTopicReplyUpdownLogDao.create({ userId, type, topicReplyId: id }, (err, rs) => {
                                callback(err, rs);
                            })
                        }
                    ], (err, result) => {
                        cb(err, result);
                    })
                    break;
                case 1:
                    //顶
                    async.series([
                        (callback) => {
                            circleTopicReplyDao.addUpCnt(id, (err, rs) => {
                                callback(err, rs);
                            })
                        },
                        (callback) => {
                            circleTopicReplyUpdownLogDao.create({ userId, type, topicReplyId: id }, (err, rs) => {
                                callback(err, rs);
                            })
                        }
                    ], (err, result) => {
                        cb(err, result);
                    })
                    break;
                default:
                    cb(err, rows, { warning: '只能传值2：踩，1：顶' });
                    break;
            }
  
