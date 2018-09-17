/**
 * created By:zstone
 * 圈子
 */


const _ = require('lodash');
const circleService = require('../circleService/circleService');
const circleTagService = require('../circleService/circleTagService');
const utils = require('../utils/utils');
const errcode = require('../utils/errcode');
const auth = require('../middleware/auth');


//1:添加circle
let addCircle = (req, res, next) => {
    let circle = Object.assign({}, _.pick(req.body, ['name', 'avatar', 'des', 'longitude', 'latitude', 'tags', 'lang', 'address']));
    circle.tags = circle.tags ? circle.tags.split(',') : [];
    circle.longitude ? circle.longitude = parseFloat(circle.longitude) : null;
    circle.latitude ? circle.latitude = parseFloat(circle.latitude) : null;
    let token = utils.getToken(req);
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circle.publisher = user.id;
        circleService.createCircle(circle, (err, rs, id) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(Object.assign({ errcode: 0, errmsg: '成功' }, { id }));
        })
    })
}
//2:circleList
let circleList = (req, res, next) => {
    let page = parseInt(req.query.page) || 1;
    let pageSize = utils.checkPageSize(req.query.pageSize);
    let offset = (page - 1) * pageSize;
    let token = utils.getToken(req);
    let q = req.query.q || '';
    let lang = req.query.lang;
    let searchType = req.query.searchType; //1:查已加入的圈子2：分页查未加入的圈子
    if ([1, 2, '1', '2', '', null, undefined].indexOf(searchType) == -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.getCircleList(user.id, offset, pageSize, q, lang, searchType, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            let list = rs.list;
            let count = rs.count ? rs.count[0]['count'] : 0;
            return res.json(searchType == 1 ? utils.successList(list) : utils.successList(list, count));
        });
    })
}

//3:根据经纬度及半径查找圈子
let circleMap = (req, res, next) => {
    let longitude = req.query.longitude ? parseFloat(req.query.longitude) : null;
    let latitude = req.query.latitude ? parseFloat(req.query.latitude) : null;
    let radius = req.query.radius ? parseFloat(req.query.radius) : 5000.00;
    circleService.getCircleMap(longitude, latitude, radius, (err, rs) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        res.json(utils.success(rs));
    });
}
//4:标签列表
let tagList = (req, res, next) => {
    circleTagService.getTagList((err, rows) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        res.json(Object.assign({ errcode: 0, errmsg: '成功' }, {
            circle_hot_tags: rows.map((row, index) => {
                row.id = index;
                return row;
            })
        }));
    })
}
//5:圈子置顶
let circleRecommend = (req, res, next) => {
    let id = req.query.id;
    if (!id) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    circleService.updateCircle({ type: 2 }, id, (err, rs) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        res.json(errcode.SUCCESS);
    });
}

//6:加入圈子
let circleJoin = (req, res, next) => {
    let id = req.query.id;
    let token = utils.getToken(req);
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.joinCircle(user.id, id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(errcode.SUCCESS);
        });
    })
}
//7:圈子加入申请审核列表
let circleJoinList = (req, res, next) => {
    let id = req.query.id;
    let page = parseInt(req.query.page) || 1;
    let pageSize = utils.checkPageSize(req.query.pageSize);
    let offset = (page - 1) * pageSize;
    let token = utils.getToken(req);
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    if (!id) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.joinCircleList(offset, pageSize, user.id, id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            let list = rs.list;
            let count = rs.count[0] ? rs.count[0]['count'] : 0;
            return res.json(utils.successList(list, count));
        });
    })
}
//8:加入圈子审核
let circleJoinCheck = (req, res, next) => {
    let id = req.query.id; //circle_user_mid的id
    let type = req.query.type ? parseInt(req.query.type) : null; //操作类型，0：拒绝 1：同意
    let token = utils.getToken(req);
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    if ([0, 1].indexOf(type) === -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.updateCircleUserMid({ status: type }, id, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(errcode.SUCCESS);
        });
    })
}
//9:圈子详情,基本信息
let circleQuery = (req, res, next) => {
    let token = utils.getToken(req);
    let id = req.query.id;//圈子id
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.queryById(id, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(utils.success((rs || rs.length > 0) ? _.pick(rs[0], ['id', 'name', 'avatar', 'des', 'activity', 'joinStatus', 'publisher', 'longitude', 'latitude', 'userAvatar', 'nickname', 'verified']) : ''));
        });
    })
}

//10:圈子详情,动态（文章，视频，话题）
let circleQueryDetail = (req, res, next) => {
    let id = req.query.id; // 圈子id
    let page = parseInt(req.query.page) || 1;
    let pageSize = utils.checkPageSize(req.query.pageSize);
    let offset = (page - 1) * pageSize;
    let token = utils.getToken(req);
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.queryByIdDetail(id, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(Object.assign({ errcode: 0, errmsg: '成功' }, { list: rs.slice(offset, pageSize), count: rs.length }));
        });
    })
}

//11:圈子成员
let circleMembers = (req, res, next) => {
    let id = req.query.id; //圈子id
    let page = parseInt(req.query.page) || 1;
    let pageSize = utils.checkPageSize(req.query.pageSize);
    let offset = (page - 1) * pageSize;
    let token = utils.getToken(req);
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.queryByIdMembers(id, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(Object.assign({ errcode: 0, errmsg: '成功' }, { list: rs.otherMembers.slice(offset, pageSize), count: rs.otherMembers.length, selfMember: rs.selfMember }));
        });
    })
}

//12:作品置顶（只能置顶作品中的文章，视频，话题中的一个，如果置顶其他一个，已被置顶的那一个默认自动取消置顶）
let workRecommend = (req, res, next) => {
    let id = req.query.id;
    let recommendId = req.query.recommendId;
    let type = ['article', 'video', 'topic'].indexOf(req.query.type) === -1 ? '' : req.query.type;//分为'article','video','topic'
    let recommendType = ['article', 'video', 'topic'].indexOf(req.query.recommendType) === -1 ? '' : req.query.recommendType;//分为'article','video','topic'
    if (!id || !type) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    circleService.workRecommend(id, type, recommendId, recommendType, (err, rs) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        res.json(errcode.SUCCESS);
    });
}

//13:发布文章
let publishArticle = (req, res, next) => {
    let token = utils.getToken(req);
    let article = _.pick(req.body, ['cover', 'title', 'content', 'circleId']);
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        article.publisher = user.id;
        circleService.publishArticle(article, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//14:发布视频
let publishVideo = (req, res, next) => {
    let token = utils.getToken(req);
    let video = _.pick(req.body, ['des', 'url', 'circleId', 'postId']);
    video.tags = req.body.tags ? req.body.tags.split(',') : [];
    req.body.longitude ? video.longitude = parseFloat(req.body.longitude) : console.log('');
    req.body.latitude ? video.latitude = parseFloat(req.body.latitude) : console.log('');
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        video.publisher = user.id;
        circleService.publishVideo(video, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//15:发布话题
let publishTopic = (req, res, next) => {
    let token = utils.getToken(req);
    let topic = _.pick(req.body, ['title', 'des', 'circleId']);
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        topic.publisher = user.id;
        circleService.publishTopic(topic, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//16:修改圈子资料
let modifyCircleBasic = (req, res, next) => {
    let id = req.body.id;
    let newCircleBasic = _.pick(req.body, ['avatar', 'name', 'des', 'longitude', 'latitude']);
    circleService.modifyCircleBasic(newCircleBasic, id, (err, rows) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        return res.json(errcode.SUCCESS);
    });
}

//17:话题详情页
let topicDetail = (req, res, next) => {
    let id = req.query.id;  //话题id
    let page = parseInt(req.query.page) || 1;
    let pageSize = utils.checkPageSize(req.query.pageSize);
    let offset = (page - 1) * pageSize;
    let token = utils.getToken(req); //token可选
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.topicDetail(id, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(Object.assign({ errcode: 0, errmsg: '成功' }, {
                basicInfo: rs.basicInfo, replyInfo: {
                    list: rs.replyInfo.sort((pre, curr) => {
                        return curr.createAt - pre.createAt;
                    }).slice(offset, pageSize), count: rs.replyInfo.length
                }
            }));
        });
    })
}

//18:顶踩话题回复
let updownTopicReply = (req, res, next) => {
    let token = utils.getToken(req);
    let id = req.query.id; //圈子话题回复id
    let type = req.query.type ? parseInt(req.query.type) : 0; //up为1，down为2
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        circleService.updownTopicReply(id, type, user.id, (err, rs, msg) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            if (msg) {
                return res.json(msg);
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//19:圈子话题发表看法
let releaseView = (req, res, next) => {
    let token = utils.getToken(req);
    let view = req.query.view; //看法
    let id = req.query.id; //话题id
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        circleService.releaseView(user.id, view, id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//20:删除圈子话题看法
let delView = (req, res, next) => {
    let token = utils.getToken(req);
    let id = req.query.id; //话题回复id
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.delView(user.id, id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//21:圈子文章详情
let articleDetail = (req, res, next) => {
    let token = utils.getToken(req);
    let id = req.query.id; //文章id
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.articleDetail(id, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(utils.success(rs));
        });
    })
}

//22:圈子文章分享
let articleShare = (req, res, next) => {
    let id = req.query.id; //文章的id
    circleService.articleShare(id, (err, rs) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        return res.json(errcode.SUCCESS);
    });
}

//23:圈子文章的点赞
let articleFav = (req, res, next) => {
    let id = req.query.id;//文章的id
    let type = req.query.type;//1:点赞2：取消点赞
    let token = utils.getToken(req); //必传
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    if ([1, 2, '1', '2'].indexOf(type) == -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        circleService.articleFav(id, user.id, type, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//24:圈子地图，点击圈子时显示的视频
let circleQueryVideo = (req, res, next) => {
    let id = req.query.id;
    let page = req.query.page ? parseInt(req.query.page) : null || 1;
    let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null || 10;
    let offset = (page - 1) * pageSize;
    circleService.circleQueryVideo(id, offset, pageSize, (err, rows) => {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        rows.count = rows.count[0].count;
        res.json(Object.assign({ errcode: 0, errmsg: '成功' }, rows));
    });
}

//25:圈子作品添加评论
let circleAddComment = (req, res, next) => {
    let parentId = req.body.parentId || 0; //父评论，如果是第一级则传0
    let commentWords = req.body.commentWords;
    let token = utils.getToken(req);
    let workId = req.body.workId;
    let type = req.body.type;   //作品类型 1文章 2视频
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        circleService.circleAddComment(parentId, commentWords, workId, user.id, type, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//26:圈子作品删除评论
let circleDelComment = (req, res, next) => {
    let token = utils.getToken(req);
    let commentId = req.query.commentId;
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        circleService.circleDelComment(commentId, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//27:查看圈子作品的父评论
let circlePCommentQuery = (req, res, next) => {
    let token = utils.getToken(req); //可选
    let workId = req.query.workId;
    let type = req.query.type;   //作品类型 1文章 2视频
    let page = req.query.page ? parseInt(req.query.page) : null || 1;
    let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null || 10;
    let offset = (page - 1) * pageSize;
    if ([1, 2, '1', '2'].indexOf(type) == -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.circlePCommentQuery(workId, type, user.id, offset, pageSize, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(utils.success(rs));
        });
    })
}

//28:查看圈子作品的子评论（评论的回复）
let circleCCommentQuery = (req, res, next) => {
    let token = utils.getToken(req); //可选
    let commentId = req.query.commentId;//父评论id
    let page = req.query.page ? parseInt(req.query.page) : null || 1;
    let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null || 100;
    let offset = (page - 1) * pageSize;
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.circleCCommentQuery(commentId, user.id, offset, pageSize, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(Object.assign({ errcode: 0, errmsg: '成功' }, rs));
        });
    })
}

//29:退出圈子
let quitCircle = (req, res, next) => {
    let token = utils.getToken(req);
    let circleId = req.query.circleId;
    if (!token || !circleId) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        circleService.quitCircle(circleId, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//30:解散圈子
let dissolveCircle = (req, res, next) => {
    let token = utils.getToken(req);
    let circleId = req.query.circleId;
    if (!token || !circleId) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        circleService.dissolveCircle(circleId, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//31:踢出圈子
let beQuitedCircle = (req, res, next) => {
    let token = utils.getToken(req);
    let circleUserMidId = req.query.circleUserMidId;
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    if (!circleUserMidId) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.beQuitedCircle(circleUserMidId, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            return res.json(errcode.SUCCESS);
        });
    })
}

//32:点赞圈子话题的回复 deprecated
let replyFav = (req, res, next) => {
    let token = utils.getToken(req);
    let replyId = req.query.replyId;
    let type = req.query.type; //1点赞2取消点赞
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    if ([1, 2, '1', '2'].indexOf(type) == -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.replyFav(replyId, user.id, type, (err, rows) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(errcode.SUCCESS);
        });
    })
}

//33:圈子审核 deprecated
let circleCheck = (req, res, next) => {
    let circleId = req.query.circleId;
    let token = utils.getToken(req);
    let type = req.query.type; //1审核通过2拒绝
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    if ([1, 2, '1', '2'].indexOf(type) == -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.circleCheck(circleId, userId, type, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(errcode.SUCCESS);
        });
    })
}

//34:圈子消息变已通知  deprecated
let circleMsgModify = (req, res, next) => {
    let token = utils.getToken(req);
    let circleMsgId = req.query.circleMsgId;
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.circleMsgModify(circleMsgId, user.id, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(errcode.SUCCESS);
        });
    })
}

//35:圈子消息的通知列表
let circleMsgList = (req, res, next) => {
    let token = utils.getToken(req);
    let page = req.query.page ? parseInt(req.query.page) : null || 1;
    let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null || 100;
    let offset = (page - 1) * pageSize;
    if (!token) {
        return res.json(errcode.TOKEN_NOT_EXIST);
    }
    auth.checkToken(token, function (err, user) {
        if (err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.circleMsgList(user.id, offset, pageSize, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(Object.assign({ errcode: 0, errmsg: '成功' }, rs));
        });
    })
}

//36:作品删除
let workDel = (req, res, next) => {
    let workId = req.query.workId;
    let workType = req.query.workType;
    let token = utils.getToken(req);
    if (['article', 'video', 'topic'].indexOf(workType) == -1) {
        return res.json(errcode.ILLEGAL_PARAMS);
    }
    auth.checkToken(token, function (err, user) {
        if (!token) {
            user = { id: '' };
        }
        if (token && err) {
            return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
        }
        circleService.workDel(user.id, workId, workType, (err, rs) => {
            if (err) {
                return res.json(utils.exerr(errcode.DB_QUERY_FAILED, err));
            }
            res.json(errcode.SUCCESS);
        });
    })
}


module.exports = {
    'POST /addCircle': addCircle,    //1:添加circle params:'name', 'avatar', 'des', 'longitude','latitude', 'tags', 'publisher'
    'GET /circleList': circleList,    //2:circleList  params:'page', 'pageSize', 'token'
    'GET /circleMap': circleMap,
    'GET /tagList': tagList,
    'GET /circleRecommend': circleRecommend,
    'GET /circleJoin': circleJoin,
    'GET /circleJoinList': circleJoinList,
    'GET /circleJoinCheck': circleJoinCheck,
    'GET /circleQuery': circleQuery,
    'GET /circleQueryDetail': circleQueryDetail,
    'GET /circleMembers': circleMembers,
    'GET /workRecommend': workRecommend,
    'POST /publishArticle': publishArticle,
    'POST /publishVideo': publishVideo,
    'POST /publishTopic': publishTopic,
    'POST /modifyCircleBasic': modifyCircleBasic,
    'GET /topicDetail': topicDetail,
    'GET /updownTopicReply': updownTopicReply,
    'GET /releaseView': releaseView,
    'GET /delView': delView,
    'GET /articleDetail': articleDetail,
    'GET /articleShare': articleShare,
    'GET /articleFav': articleFav,
    'GET /circleQueryVideo': circleQueryVideo,
    'POST /circleAddComment': circleAddComment,
    'GET /circleDelComment': circleDelComment,
    'GET /circlePCommentQuery': circlePCommentQuery,
    'GET /circleCCommentQuery': circleCCommentQuery,
    'GET /quitCircle': quitCircle,
    'GET /dissolveCircle': dissolveCircle,
    'GET /beQuitedCircle': beQuitedCircle,
    'GET /replyFav': replyFav,
    'GET /circleMsgModify': circleMsgModify,
    'GET /circleMsgList': circleMsgList,
    'GET /workDel': workDel
}
