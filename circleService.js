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

exports.updateCircleUserMid = (param, id, userId, cb) => {
    //首先查询该用户是否为该圈子的publisher
    circleUserMidDao.queryById(id, (err, rows0) => {
        if (err) {
            return cb(err, rows0);
        }
        if (!rows0 || rows0.length < 1) {
            return cb('没有该申请！', null);
        }
        if (param.status == 0 && rows0[0].status == 0) {
            //已经被删除的不能执行删除操作
            return cb('已经被删除的不能执行删除操作', null);
        }
        if (param.status == 1 && rows0[0].status == 1) {
            //已经加入的不能重复加入
            return cb('已经加入的不能重复加入', null);
        }
        circleDao.queryByOthers({ id: rows0[0].circleId, publisher: userId, status: 1 }, (err, rows1) => {
            if (err) {
                return cb(err, rows1);
            }
            if (!rows1 || rows1.length < 1) {
                //该用户不是圈主
                return cb('该用户不是圈主！', null);
            }
            async.parallel([
                //是圈主，允许他操作
                (callback) => {
                    circleUserMidDao.updateById(param, id, (err, rs) => {
                        if (err) {
                            return callback(err, rows1);
                        }
                        //2创建消息
                        circleMsgDao.create({ type: 3, msgTxt: param.status == 0 ? '圈子加入未通过审核，试试加入其他圈子吧。' : '圈子加入通过审核，快去和小伙伴们一起玩耍吧！', circleUserMidId: id }, (err, rows2) => {
                            if (err) {
                                return cb(err, rows2);
                            }
                            //3通知申请人
                            async.waterfall([
                                //找到申请人
                                (callback1) => {
                                    circleUserMidDao.queryById(id, (err, rows3) => {
                                        callback1(err, rows3);
                                    });
                                },
                                //添加消息通知人
                                (rows3, callback1) => {
                                    circleMsgUserMidDao.create({ circleMsgId: rows2.insertId, userId: rows3[0].userId, isNotified: 0 }
                                        , (err, rows) => {
                                            callback1(err, rows);
                                        });
                                }
                            ], (err, rows3) => {
                                callback(err, rows3);
                            });
                        });
                    })
                },
                //这里需要更新圈子的活跃值
                (callback) => {
                    circleDao.circleActivityModify(rows0[0].circleId, (err, rs) => {
                        callback(err, rs);
                    })
                }
            ], (err, results) => {
                cb(err, results);
            });
        });
    });
}

exports.joinCircle = (userId, circleId, cb) => {
    circleUserMidDao.queryByOthers({ userId, circleId }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (rows && rows.length > 0) {
            if (rows[0].status == 1) {
                //已经加入
                return cb('该用户已加入！', null);
            } else if (rows[0].status == 2) {
                return cb('该用户已申请！', null);
            } else {
                circleUserMidDao.updateByOthers({ userId, circleId }, { status: 2 }, (err, rs) => {
                    cb(err, rs);
                });
            }
        } else {
            circleUserMidDao.create({ userId, circleId }, (err, rs) => {
                cb(err, rs);
            });
        }
    });
}

exports.joinCircleList = (start, limit, userId, circleId, cb) => {
    circleUserMidDao.joinCircleList(start, limit, userId, circleId, (err, rs) => {
        cb(err, rs);
    });
}

exports.queryById = (id, userId, cb) => {
    circleUserMidDao.circleDynamicMsgCntClear(id, userId, (err, rows0) => {
        //查看圈子详情时，首先清空圈子动态消息数
        if (err) {
            return cb(err, rows0);
        }
        circleDao.queryById(id, (err, rows) => {
            if (err || !rows[0]) {
                return cb(err, rows);
            }
            userDao.queryById(rows[0].publisher, (err, row1) => {
                rows = rows.filter(row => row.status == 1);
                if (row1) {
                    rows[0] ? rows[0].userAvatar = (row1 && row1[0]) ? row1[0].avatar : '' : console.log();
                    rows[0] ? rows[0].nickname = (row1 && row1[0]) ? row1[0].nickname : '' : console.log();
                    rows[0] ? rows[0].verified = (row1 && row1[0]) ? row1[0].verified : '' : console.log();
                }
                //查看该成员是否加入该圈子
                if (!userId) {
                    rows.forEach(row => row.joinStatus = 0);
                    return cb(err, rows);
                } else {
                    circleUserMidDao.queryByOthers({ userId, circleId: id }, (err, rs) => {
                        if (rs && rs.length > 0 && rs[0].status == 1) {
                            //该用户已加入
                            rows.forEach(row => row.joinStatus = 1);
                        } else if (rs && rs.length > 0 && rs[0].status == 2) {
                            //该用户正在申请
                            rows.forEach(row => row.joinStatus = 2);
                        } else {
                            //该用户没有申请,也没加入
                            rows.forEach(row => row.joinStatus = 0);
                        }
                        cb(err, rows);
                    });
                }
            })
        });
    })
}

exports.queryByIdDetail = (id, userId, cb) => {
    async.parallel({
        //1:文章
        articles: (callback) => {
            circleArticleDao.queryByOtherWithPublisherNickname({ key: "circleId", value: id }, userId, (err, rows) => {
                callback(err, rows);
            })
        },
        //2:视频
        videos: (callback) => {
            async.waterfall([
                //2.1：视频基本信息
                (cb1) => {
                    circleVideoDao.queryVideoDetail(id, (err, rows) => {
                        if (!userId) {
                            //没有传入token
                            cb1(err, rows.map(row => {
                                row.liked = 0;
                                row.faved = 0;
                                return row;
                            }));
                        } else {
                            //传入了token
                            circleVideoDao.queryVideoLiked(rows.map(row => row.postId), userId, (err, rows5) => {
                                cb1(err, rows.map((row, index) => {
                                    row.liked = rows5[index].liked;
                                    row.faved = rows5[index].faved;
                                    return row;
                                }));
                            })
                        }
                    })
                },
                //3.2:视频的评论信息
                (rows1, cb1) => {
                    async.every(rows1.map(row1 => row1.postId), (id, cb3) => {
                        circleVideoDao.queryVideoComments(id, (err, rs1) => {
                            rows1.forEach(row1 => {
                                if (row1.postId == id) {
                                    row1.comments = rs1;
                                }
                            });
                            cb3(err, rs1);
                        });
                    }, (err, results) => {
                        cb1(err, rows1);
                    })
                }
            ], (err, rs) => {
                callback(err, rs);
            });
        },
        //3:话题
        topics: (callback) => {
            async.waterfall([
                //3.1：话题基本信息
                (cb1) => {
                    circleTopicDao.queryByOther({ key: "circleId", value: id }, (err, rows) => {
                        cb1(err, rows);
                    })
                },
                //3.2:话题的reply信息
                (rows, cb1) => {
                    async.every(rows.map(row => row.id), (id, cb2) => {
                        if (!userId) {
                            circleTopicReplyDao.queryByOthersWithNickname({ topicId: id, status: 1 }, (err, rs) => {
                                rows.forEach(row => {
                                    if (row.id == id) {
                                        row.reply = rs ? rs.sort((pre, curr) => (curr.createAt - pre.createAt)) : [];
                                        row.replyCnt = rs ? rs.length : 0;
                                    }
                                });
                                cb2(err, rs);
                            });
                        } else {
                            circleTopicReplyDao.queryByOthersWithFav({ topicId: id, status: 1 }, userId, (err, rs) => {
                                rows.forEach(row => {
                                    if (row.id == id) {
                                        row.reply = rs ? rs.sort((pre, curr) => (curr.createAt - pre.createAt)) : [];
                                        row.replyCnt = rs ? rs.length : 0;
                                    }
                                });
                                cb2(err, rs);
                            });
                        }
                    }, (err, results) => {
                        cb1(err, rows);
                    })
                }
            ], (err, rs) => {
                callback(err, rs);
            })
        }
    }, (err, results) => {
        let list = [];
        Object.keys(results).map(key => {
            results[key] ? results[key].forEach(item => {
                item.type = key;
                list.push(item);
            }) : results[key];
        })
        //按createAt的降序排列
        cb(err, list.sort((pre, curr) => {
            return curr.createAt - pre.createAt;
            //将被推荐的作品放在第一个位置
        }).sort((pre, curr) => {
            if (curr.isRecommend == 1) {
                return 1;
            }
        }));
    });
}

exports.queryByIdMembers = (id, userId, cb) => {
    circleUserMidDao.queryByOthersComplex({ userId: null, circleId: id, status: 1 }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        //查找该用户是否加入了该圈子
        if (!userId) {
            //如果没有传token
            return cb(err, {
                otherMembers: rows.sort((pre, curr) => {
                    return curr.activity - pre.activity;
                }).map(row => {
                    row.follows ? row.follows : row.follows = 0;
                    return row;
                })
            });
        } else {
            //如果传token
            circleUserMidDao.queryByOthersComplex({ userId, circleId: id, status: 1 }, (err, rs) => {
                if (rs && rs.length > 0) {
                    //该用户加入了该圈子
                    return cb(err, {
                        otherMembers: rows.sort((pre, curr) => {
                            return curr.activity - pre.activity;
                        }).map(row => {
                            row.follows ? row.follows : row.follows = 0;
                            return row;
                        }),
                        selfMember: rs.map((row, index) => {
                            row.follows ? row.follows : row.follows = 0;
                            rows.map((row1, index) => {
                                if (row1.id == row.id) {
                                    row.rank = index + 1;
                                }
                            })
                            return row;
                        })
                    });
                } else {
                    //该用户没有加入该圈子
                    return cb(err, {
                        otherMembers: rows.sort((pre, curr) => {
                            return curr.activity - pre.activity;
                        }).map(row => {
                            row.follows ? row.follows : row.follows = 0;
                            return row;
                        })
                    });
                }
            });
        }
    });
}

exports.publishArticle = (article, cb) => {
    circleUserMidDao.circleDynamicMsgCntPlus(article.circleId, (err, rows0) => {
        //发布文章，首先圈子动态消息数加一
        if (err) {
            return cb(err, rows0);
        }
        circleArticleDao.create(article, (err, rows) => {
            cb(err, rows);
        })
    })
}

exports.publishVideo = (video, cb) => {
    circleUserMidDao.circleDynamicMsgCntPlus(video.circleId, (err, rows0) => {
        //发布文章，首先圈子动态消息数加一
        if (err) {
            return cb(err, rows0);
        }
        async.waterfall([
            (callback) => {
                circleVideoDao.create(_.omit(video, ['tags']), (err, rows) => {
                    callback(err, rows.insertId);
                })
            },
            (id, callback) => {
                circleVideoTagDao.battleCreate(video.tags.map(tag => {
                    return { videoId: id, tag };
                }), (err, rows) => {
                    callback(err, rows);
                });
            }
        ], (err, rs) => {
            cb(err, rs);
        });
    })
}

exports.publishTopic = (topic, cb) => {
    circleUserMidDao.circleDynamicMsgCntPlus(topic.circleId, (err, rows0) => {
        //0发布话题，首先圈子动态消息数加一
        if (err) {
            return cb(err, rows0);
        }
        //1创建话题
        circleTopicDao.create(topic, (err, rows1) => {
            if (err) {
                return cb(err, rows1);
            }
            //2创建消息
            circleMsgDao.create({ type: 1, msgTxt: topic.title, topicId: rows1.insertId }, (err, rows2) => {
                if (err) {
                    return cb(err, rows1);
                }
                //3通知圈内人
                async.waterfall([
                    //找到圈内人
                    (callback) => {
                        circleUserMidDao.queryByOthers({ circleId: topic.circleId, status: 1 }, (err, rows) => {
                            callback(err, rows);
                        });
                    },
                    //添加消息通知人
                    (rows, callback) => {
                        circleMsgUserMidDao.battleCreate(rows.map(row => {
                            return { circleMsgId: rows2.insertId, userId: row.userId, isNotified: 0 };
                        }), (err, rows) => {
                            callback(err, rows);
                        });
                    }
                ], (err, rows3) => {
                    cb(err, rows3);
                });
            });
        })
    })
}

exports.workRecommend = (id, type, recommendId, recommendType, cb) => {
    if (!recommendId || !recommendType) {
        //只添加推荐
        exports.workRecommendChange(id, type, { isRecommend: 1 }, (err, rows) => {
            cb(err, rows);
        })
    } else {
        //先删除推荐，再添加推荐
        async.series([
            (callback) => {
                exports.workRecommendChange(recommendId, recommendType, { isRecommend: 0 }, (err, rows) => {
                    callback(err, rows);
                })
            },
            (callback) => {
                exports.workRecommendChange(id, type, { isRecommend: 1 }, (err, rows) => {
                    callback(err, rows);
                })
            }
        ], (err, rs) => {
            cb(err, rs);
        });
    };
}
exports.workRecommendChange = (id, type, isRecommend, cb) => {
    switch (type) {
        case 'article':
            circleArticleDao.updateById(isRecommend, id, (err, rows) => {
                cb(err, rows);
            });
            break;
        case 'video':
            circleVideoDao.updateById(isRecommend, id, (err, rows) => {
                cb(err, rows);
            })
            break;
        case 'topic':
            circleTopicDao.updateById(isRecommend, id, (err, rows) => {
                cb(err, rows);
            })
            break;
        default:
            break;
    }
}

exports.modifyCircleBasic = (newCircleBasic, id, cb) => {
    circleDao.updateById(newCircleBasic, id, (err, rows) => {
        cb(err, rows);
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
    circleTopicReplyUpdownLogDao.queryByOthers({ userId, topicReplyId: id }, (err, rows) => {
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
        } else if (rows[0].type == 0) {
            //顶踩被取消了
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
                            circleTopicReplyUpdownLogDao.updateByOthers({ userId, type: 0, topicReplyId: id }, { type: 2 }, (err, rs) => {
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
                            circleTopicReplyUpdownLogDao.updateByOthers({ userId, type: 0, topicReplyId: id }, { type: 1 }, (err, rs) => {
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
        } else {
            //该用户之前进行了顶踩操作
            if (rows[0].type == 1) {
                //用户已顶
                switch (type) {
                    case 2:
                        //踩
                        async.series([
                            //加踩
                            (callback) => {
                                circleTopicReplyDao.addDownCnt(id, (err, rs) => {
                                    callback(err, rs);
                                })
                            },
                            //减顶
                            (callback) => {
                                circleTopicReplyDao.minuUpCnt(id, (err, rs) => {
                                    callback(err, rs);
                                })
                            },
                            //修改操作类型
                            (callback) => {
                                circleTopicReplyUpdownLogDao.updateByOthers({ userId, type: 1, topicReplyId: id }, { type: 2 }, (err, rs) => {
                                    callback(err, rs);
                                })
                            }
                        ], (err, result) => {
                            cb(err, result);
                        })
                        break;
                    case 1:
                        //顶,二次顶，即为取消顶
                        async.series([
                            //减顶
                            (callback) => {
                                circleTopicReplyDao.minuUpCnt(id, (err, rs) => {
                                    callback(err, rs);
                                })
                            },
                            //修改操作类型
                            (callback) => {
                                circleTopicReplyUpdownLogDao.updateByOthers({ userId, type: 1, topicReplyId: id }, { type: 0 }, (err, rs) => {
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
            } else if (rows[0].type == 2) {
                //用户已踩
                switch (type) {
                    case 2:
                        //踩，二次踩，即为取消踩
                        async.series([
                            //减踩
                            (callback) => {
                                circleTopicReplyDao.minuDownCnt(id, (err, rs) => {
                                    callback(err, rs);
                                })
                            },
                            //修改操作类型
                            (callback) => {
                                circleTopicReplyUpdownLogDao.updateByOthers({ userId, type: 2, topicReplyId: id }, { type: 0 }, (err, rs) => {
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
                            //加顶
                            (callback) => {
                                circleTopicReplyDao.addUpCnt(id, (err, rs) => {
                                    callback(err, rs);
                                })
                            },
                            //减踩
                            (callback) => {
                                circleTopicReplyDao.minuDownCnt(id, (err, rs) => {
                                    callback(err, rs);
                                })
                            },
                            //修改操作类型
                            (callback) => {
                                circleTopicReplyUpdownLogDao.updateByOthers({ userId, type: 2, topicReplyId: id }, { type: 1 }, (err, rs) => {
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
            }
        }
    });
};

exports.releaseView = (publisher, des, topicId, cb) => {
    circleTopicReplyDao.create({ publisher, des, topicId }, (err, rows) => {
        cb(err, rows);
    });
}

exports.delView = (publisher, replyId, cb) => {
    circleTopicReplyDao.queryById(replyId, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (rows && rows[0] && rows[0].publisher === publisher) {
            //该回复是该用户的可以进行删除操作
            circleTopicReplyDao.updateById({ status: 0 }, replyId, (err, rows) => {
                return cb(err, rows);
            });
        } else {
            return cb('该回复不是你的你不能进行删除操作，前端有控制，正常不会出现这种状况！');
        }
    });
}

exports.articleDetail = (id, userId, cb) => {
    async.waterfall([
        (callback) => {
            circleCommentDao.queryByOthers({ parentId: 0, workId: id, type: 1, status: 1 }, (err, rows0) => {
                callback(err, rows0 ? rows0.length : 0);
            });
        },
        (commentCnt, callback) => {
            if (userId) {
                circleArticleOperateLogDao.queryByOthers({ operator: userId, articleId: id, type: 1, status: 1 }, (err, rows2) => {
                    if (err) {
                        return callback(err, rows2);
                    }
                    //如果该用户已赞，则返回true否则false
                    callback(err, rows2.length > 0 ? true : false, commentCnt);
                });
            } else {
                callback(null, true, commentCnt);
            }
        },
        (flag, commentCnt, callback) => {
            circleArticleDao.queryById(id, (err, rows) => {
                return callback(err, rows, flag, commentCnt);
            });
        },
        (rows, flag, commentCnt, callback) => {
            if (!rows || rows.length < 1 || !rows[0].publisher) {
                return callback(true, rows);
            }
            userDao.queryById(rows[0].publisher, (err, rows1) => {
                return callback(err, rows.map(row => {
                    row.userAvatar = rows1[0] ? rows1[0].avatar : '';
                    row.userNickname = rows1[0] ? rows1[0].nickname : '';
                    row.verified = rows1[0] ? rows1[0].verified : '';
                    row.canFav = flag ? 0 : 1;//0不可赞，1可赞
                    row.commentCnt = commentCnt;
                    return row;
                }));
            });
        }
    ], (err, rs) => {
        cb(err, rs && rs[0] ? rs[0] : '没有文章');
    });
};

exports.articleShare = (id, cb) => {
    circleArticleDao.queryById(id, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        circleArticleDao.updateById({ shareCnt: ++rows[0].shareCnt }, id, (err, rows) => {
            cb(err, rows);
        });
    });
}

exports.articleFav = (id, userId, type, cb) => {
    if (type == 1) {
        //点赞操作
        //首先看是否已点赞
        circleArticleOperateLogDao.queryByOthers({ articleId: id, operator: userId, type: 1 }, (err, rows) => {
            if (err) {
                return cb(err, rows);
            }
            if (rows && rows.length > 0) {
                if (rows[0].status == 0) {
                    //被取消了点赞，将status改为1 
                    circleArticleOperateLogDao.updateById({ status: 1 }, rows[0].id, (err, rows) => {
                        if (err) {
                            return cb(err, rows);
                        }
                        circleArticleDao.queryById(id, (err, rows) => {
                            if (err) {
                                return cb(err, rows);
                            }
                            circleArticleDao.updateById({ favCnt: ++rows[0].favCnt }, id, (err, rows) => {
                                return cb(err, rows);
                            });
                        });
                    });
                } else {
                    //已被点赞
                    return cb('你已经点了赞', null);
                }
            } else {
                circleArticleOperateLogDao.create({ operator: userId, articleId: id, type: 1 }, (err, rows) => {
                    if (err) {
                        return cb(err, rows);
                    }
                    circleArticleDao.queryById(id, (err, rowsa) => {
                        if (err) {
                            return cb(err, rowsa);
                        }
                        circleArticleDao.updateById({ favCnt: ++rowsa[0].favCnt }, id, (err, rows) => {
                            // cb(err, rows);
                            if (err) {
                                return cb(err, rows);
                            }
                            //根据userId找到userInfo
                            userDao.queryById(userId, (err, rowsu) => {
                                if (err) {
                                    return cb(err, rows);
                                }
                                //2创建消息
                                circleMsgDao.create({ type: 4, msgTxt: `${rowsu[0].avatar}&&${rowsu[0].verified}&&${rowsu[0].nickname}赞了你的作品！`, workType: 1, workId: id }, (err, rows2) => {
                                    if (err) {
                                        return cb(err, rows2);
                                    }
                                    //3通知圈内人
                                    //添加消息通知人
                                    circleMsgUserMidDao.create({ circleMsgId: rows2.insertId, userId: rowsa[0].publisher, isNotified: 0 }, (err, rows) => {
                                        cb(err, rows);
                                    });
                                });
                            })
                        });
                    });
                });
            }
        });
    } else {
        //取消点赞操作
        circleArticleOperateLogDao.queryByOthers({ articleId: id, operator: userId, type: 1 }, (err, rows) => {
            if (err) {
                return cb(err, rows);
            }
            if (rows && rows.length > 0) {
                if (rows[0].status == 1) {
                    //被点赞，将status改为0
                    circleArticleOperateLogDao.updateById({ status: 0 }, rows[0].id, (err, rows) => {
                        if (err) {
                            return cb(err, rows);
                        }
                        circleArticleDao.queryById(id, (err, rows) => {
                            if (err) {
                                return cb(err, rows);
                            }
                            circleArticleDao.updateById({ favCnt: --rows[0].favCnt }, id, (err, rows) => {
                                return cb(err, rows);
                            });
                        });
                    });
                } else {
                    //已被点赞
                    return cb('你已经取消了点赞', null);
                }
            } else {
                return cb('你还没点赞', null);
            }
        });
    }
};

exports.circleQueryVideo = (circleId, start, limit, cb) => {
    circleVideoDao.queryVideoDetailPage(circleId, start, limit, (err, rows) => {
        cb(err, rows);
    })
}

exports.circleAddComment = (parentId = 0, commentWords, workId, commentor, type, cb) => {
    circleCommentDao.create({ parentId, commentWords, workId, commentor, type }, (err, rows) => {
        if (parentId == 0) {
            cb(err, rows);
        } else {
            //是回复，得添加消息通知
            //1找到父id的commentor
            async.waterfall([
                (callback) => {
                    circleCommentDao.queryById(parentId, (err, rows1) => {
                        callback(err, rows1);
                    });
                },
                (rows1, callback) => {
                    circleMsgDao.create({ type: 5, msgTxt: `你的评论有一条回复！` }, (err, rows2) => {
                        callback(err, rows2, rows1);
                    });
                },
                (rows1, rows2, callback) => {
                    circleMsgUserMidDao.create({ circleMsgId: rows1.insertId, userId: rows2[0].commentor, isNotified: 0 }, (err, rows3) => {
                        callback(err, rows3);
                    });
                }
            ], (err, rs) => {
                cb(err, rs);
            });
        }
    });
}

exports.circleDelComment = (commentId, commentor, cb) => {
    //首先得证明这条评论属于该用户
    circleCommentDao.queryByOthers({ id: commentId, commentor, status: 1 }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (rows && rows.length > 0) {
            //属于该用户
            circleCommentDao.updateById({ status: 0 }, commentId, (err, rows1) => {
                return cb(err, rows1);
            });
        } else {
            return cb('评论不属于该用户', null);
        }
    })
}

exports.circlePCommentQuery = (workId, type, commentor, start, limit, cb) => {
    circleCommentDao.queryByOthersPageWithCnt({ workId, type, status: 1, parentId: 0 }, start, limit, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (!commentor) {
            rows.list = rows.list.map(row => {
                row.canDel = false;
                return row;
            })
            cb(err, rows);
        } else {
            circleCommentDao.queryByOthers({ workId, type, commentor, status: 1, parentId: 0 }, (err, rows1) => {
                if (err) {
                    return cb(err, rows);
                }
                rows1 = rows1.map(row1 => row1.id);
                rows.list = rows.list.map(row => {
                    if (rows1.indexOf(row.id) == -1) {
                        row.canDel = false;
                    } else {
                        row.canDel = true;
                    }
                    return row;
                })
                cb(err, rows)
            });
        }
    });
}

exports.circleCCommentQuery = (commentId, commentor, start, limit, cb) => {
    circleCommentDao.circleCCommentQuery(commentId, start, limit, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (!commentor) {
            //没有传入token
            rows.list.map(row => {
                row.canDel = false;
                return row;
            })
            cb(err, rows);
        } else {
            //传入了token
            rows.list.map(row => {
                if (row.commentor == commentor) {
                    row.canDel = true;
                } else {
                    row.canDel = false;
                }
                return row;
            })
            cb(err, rows);
        }
    });
}

exports.quitCircle = (circleId, userId, cb) => {
    circleUserMidDao.queryByOthers({ circleId, userId, status: 1 }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (!rows || rows.length < 1) {
            //该用户没有加入该圈子
            return cb('该用户没有加入该圈子', null);
        } else {
            circleUserMidDao.updateByOthers({ circleId, userId, status: 1 }, { status: 0 }, (err, rows) => {
                cb(err, rows);
            });
        }
    });
}

exports.beQuitedCircle = (circleIdUserMidId, userId, cb) => {
    //该用户是否为圈主
    circleUserMidDao.queryByOthers({ id: circleIdUserMidId, status: 1 }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (!rows || rows.length < 1) {
            return cb('没有该记录,circleIdUserMidId传入错误！', null);
        };
        circleDao.queryByOthers({ id: rows[0].circleId, status: 1 }, (err, rows1) => {
            if (err) {
                return cb(err, rows1);
            }
            if (!rows1 || rows1.length < 1) {
                return cb('没有该圈子！', null);
            };
            if (rows1[0].publisher == userId) {
                //是圈主
                circleUserMidDao.updateById({ status: 0 }, circleIdUserMidId, (err, rows2) => {
                    cb(err, rows2);
                });
            } else {
                //非圈主
                cb('您不是圈主，不能操作！', null);
            }
        });
    });
}

exports.dissolveCircle = (id, publisher, cb) => {
    //查询该用户是否为该圈子的圈主
    circleDao.queryByOthers({ id, publisher, status: 1 }, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        if (rows && rows.length > 0) {
            //是圈主，可以进行解散操作
            async.parallel([
                //step1:圈子状态置为0
                (callback) => {
                    circleDao.updateById({ status: 0 }, id, (err, rows) => {
                        callback(err, rows);
                    });
                },
                //step2:解散圈子所有的成员
                (callback) => {
                    circleUserMidDao.updateByOthers({ circleId: id }, { status: 0 }, (err, rows) => {
                        callback(err, rows);
                    });
                }
            ], (err, rs) => {
                cb(err, rs);
            });

        } else {
            //不是圈主
            return cb('对不起，你不是圈主，不能解散该圈子！', null);
        }
    });
}

exports.replyFav = (replyId, operator, type, cb) => {
    if (type == 1) {
        //点赞操作
        //首先看是否已点赞
        circleTopicReplyOperateLogDao.queryByOthers({ replyId, operator, type: 1 }, (err, rows) => {
            if (err) {
                return cb(err, rows);
            }
            if (rows && rows.length > 0) {
                if (rows[0].status == 0) {
                    //被取消了点赞，将status改为1 
                    circleTopicReplyOperateLogDao.updateById({ status: 1 }, rows[0].id, (err, rows) => {
                        return cb(err, rows);
                    });
                } else {
                    //已被点赞
                    return cb('你已经点了赞', null);
                }
            } else {
                circleTopicReplyOperateLogDao.create({ operator, replyId, type: 1, status: 1 }, (err, rows) => {
                    return cb(err, rows);
                });
            }
        });
    } else {
        //取消点赞操作
        circleTopicReplyOperateLogDao.queryByOthers({ replyId, operator, type: 1 }, (err, rows) => {
            if (err) {
                return cb(err, rows);
            }
            if (rows && rows.length > 0) {
                if (rows[0].status == 1) {
                    //被点赞，将status改为0
                    circleTopicReplyOperateLogDao.updateById({ status: 0 }, rows[0].id, (err, rows) => {
                        return cb(err, rows);
                    });
                } else {
                    //已被点赞
                    return cb('你已经取消了点赞', null);
                }
            } else {
                return cb('你还没点赞', null);
            }
        });
    }
}

exports.circleCheck = (circleId, userId, type, cb) => {
    //首先验证用户的权限 TODO
    if (type == 1) {
        //通过审核
        circleDao.updateById({ status: 1 }, circleId, (err, rows) => {
            cb(err, rows);
        });
    } else {
        //拒绝审核
        circleDao.updateById({ status: 3 }, circleId, (err, rows) => {
            cb(err, rows);
        });
    }
}

exports.circleMsgModify = (circleMsgId, userId, cb) => {
    circleMsgUserMidDao.updateByOthers({ circleMsgId, userId }, { isNotified: 1 }, (err, rows) => {
        cb(err, rows);
    });
}

exports.circleMsgList = (userId, start, limit, cb) => {
    circleMsgUserMidDao.circleMsgList(userId, start, limit, (err, rows) => {
        if (err) {
            return cb(err, rows);
        }
        //获取之后，消息变为已通知
        circleMsgUserMidDao.battleUpdateByOthers({ isNotified: 1 }, rows.list.map(row => {
            return { circleMsgId: row.id, userId }
        }), (err, rows1) => {
            cb(err, rows);
        });
    });
}

exports.workDel = (userId, workId, workType, cb) => {
    //首先检查该作品是否为用户的作品
    switch (workType) {
        case 'article':
            circleArticleDao.queryByOthers({ publisher: userId, id: workId, status: 1 }, (err, rows) => {
                if (err) {
                    return cb(err, rows);
                }
                if (rows.length < 1) {
                    //该用户不是该作品的发布者
                    return cb('你不是该作品的发布者，不能删除作品！', null);
                }
                circleArticleDao.updateByOthers({ publisher: userId, id: workId, status: 1 }, { status: 0 }, (err, rows1) => {
                    cb(err, rows1);
                });
            });
            break;
        case 'video':
            circleTopicDao.queryByOthers({ publisher: userId, id: workId, status: 1 }, (err, rows) => {
                if (err) {
                    return cb(err, rows);
                }
                if (rows.length < 1) {
                    //该用户不是该作品的发布者
                    return cb('你不是该作品的发布者，不能删除作品！', null);
                }
                circleTopicDao.updateByOthers({ publisher: userId, id: workId, status: 1 }, { status: 0 }, (err, rows1) => {
                    cb(err, rows1);
                });
            });
            break;
        case 'topic':
            circleTopicDao.queryByOthers({ publisher: userId, id: workId, status: 1 }, (err, rows) => {
                if (err) {
                    return cb(err, rows);
                }
                if (rows.length < 1) {
                    //该用户不是该作品的发布者
                    return cb('你不是该作品的发布者，不能删除作品！', null);
                }
                circleTopicDao.updateByOthers({ publisher: userId, id: workId, status: 1 }, { status: 0 }, (err, rows1) => {
                    cb(err, rows1);
                });
            });
            break;
        default:
            return cb('参数错误！', null);
            break;
    }
}
