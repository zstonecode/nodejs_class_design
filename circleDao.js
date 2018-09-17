/**
 * created By:zstone
 * 
 */
const { BaseDao } = require('../dao/base_dao');
const async = require('async');
const pool = require('../utils/utils').getPool();
const _ = require('lodash');

class CircleDao extends BaseDao {
    constructor(config) {
        super(config);
    }
    //extraFunc here
    getCircleList(id, start, limit, q, lang, searchType, cb) { //searchType 1:查已加入的圈子2：分页查未加入的圈子
        let dynamicMsgCntSql = '';
        let minu = 0;
        if (id && searchType == 1) {
            start = 0;
            limit = 100000;
            q = '';
        }
        if (id) {
            dynamicMsgCntSql = `(select dynamicMsgCnt from circle_user_mid where userId = ${id} and status = 1 and circleId = c.id) dynamicMsgCnt,`;
        }
        async.parallel({
            list: (callback) => {
                pool.query(`select * from (SELECT
                                    c.id,
                                    c.name,
                                    c.avatar,
                                    c.des,
                                    c.activity,
                                    c.publisher,
                                    c.lang,
                                    ${dynamicMsgCntSql}
                                    (select count(1) count from circle_user_mid cum where cum.circleId = c.id and cum.status = 1) as ucount,
                                    (SELECT count(1) FROM circle_video cv	WHERE c.id = cv.circleId and cv.status = 1 GROUP BY c.id) as vcount,
                                    (SELECT count(1) FROM circle_article ca	WHERE c.id = ca.circleId and ca.status = 1 GROUP BY c.id) as acount,
                                    (SELECT count(1) FROM circle_topic ct	WHERE c.id = ct.circleId and ct.status = 1 GROUP BY c.id) as tcount,
                                    (select a.tagnames from (select c.id,GROUP_CONCAT(ctg.tagname) tagnames from circle c left join circle_tag ctg on c.id = ctg.circleId where ctg.status = 1 GROUP BY c.id) a where a.id = c.id) tagnames,
                                    ((select activity from circle where id = c.id)+(select circleRankArtificial from circle_rankArtificial where circleId = c.id)) as weight
                                FROM
                                    circle c
                                WHERE
                                    c.status != 0
                                    and type = 3
                                    and c.lang = ?
                                GROUP BY c.id) b where b.name like '%${q}%' or b.tagnames like '%${q}%'	
                                order by b.weight desc
                                    LIMIT ?,?`, [lang, start, limit], (err, rows) => {
                        if (err) {
                            return callback(err, rows);
                        }
                        rows = rows.map(row => { return Object.assign(_.pick(row, ['id', 'name', 'avatar', 'des', 'activity', 'ucount', 'tagnames', 'lang', 'dynamicMsgCnt']), { pcount: (row.vcount || 0) + (row.acount || 0) + (row.tcount || 0), joinStatus: 0 }) });
                        if (id) {
                            //如果传来用户id,则查找哪些圈子是该用户加入了的
                            pool.query(`select circleId,status from circle_user_mid where userId = ?`, [id], (err, rows1) => {
                                if (searchType == 2) {
                                    minu = rows1.filter(row1 => row1.status == 1).length;
                                }
                                rows.forEach(row => {
                                    if (rows1.filter(row1 => row1.status === 1).map(row1 => row1.circleId).indexOf(row.id) !== -1) {
                                        row.joinStatus = 1;
                                    } else if (rows1.filter(row1 => row1.status === 2).map(row1 => row1.circleId).indexOf(row.id) !== -1) {
                                        row.joinStatus = 2; //0未加入（或未传入token）1已加入2申请加入待审核
                                    }
                                })
                                if (searchType == 1) {
                                    callback(err, rows.filter(row => {
                                        return row.joinStatus == 1;
                                    }));
                                } else if (searchType == 2) {
                                    callback(err, rows.filter(row => {
                                        return row.joinStatus != 1;
                                    }));
                                } else {
                                    callback(err, rows);
                                }
                            });
                        } else {
                            callback(err, rows.map(row => {
                                row = _.omit(row, ['dynamicMsgCnt']);
                                return row;
                            }));
                        }
                    });
            },
            count: (callback) => {
                pool.query(`SELECT
                                        count( 1 ) AS count 
                                FROM
                                        (
                                SELECT
                                        c.id,
                                        c.NAME,
                                        (
                                SELECT
                                        a.tagnames 
                                FROM
                                        (
                                SELECT
                                        c.id,
                                        GROUP_CONCAT( ctg.tagname ) tagnames 
                                FROM
                                        circle c
                                        LEFT JOIN circle_tag ctg ON c.id = ctg.circleId 
                                WHERE
                                        ctg.status = 1 
                                GROUP BY
                                        c.id 
                                        ) a 
                                WHERE
                                        a.id = c.id 
                                        ) tagnames 
                                FROM
                                        circle c
                                WHERE
                                        c.status != 0 
                                        and type = 3
                                        and c.lang = ?
                                        ) b 
                                WHERE
                                    b.NAME LIKE '%${q}%' 
                                    or b.tagnames LIKE '%${q}%'
            `, [lang], (err, rows) => {
                        callback(err, rows);
                    });
            }
        }, (err, result) => {
            if (id && searchType == 1) {
                delete result.count;
            } else if (searchType == 2) {
                result.count[0].count = result.count[0].count - minu;
            } else if (!id && searchType == 1) {
                result = { list: [] };
            }
            cb(err, result);
        });
    }
    getCircleMap(param, minLongitude, maxLongitude, minLatitude, maxLatitude, cb) {
        pool.query(`select * from circle c where ${param.key} = ${param.value} and (c.longitude BETWEEN ? and ?) and (c.latitude between ? and ?) and c.status = 1`, [minLongitude, maxLongitude, minLatitude, maxLatitude], (err, rows) => {
            cb(err, rows);
        });
    }
    //查找圈子推荐半径的常数
    findRecommendRadius(cb) {
        pool.query(`select radius from circle_constants`, (err, rows) => {
            cb(err, rows[0].radius);
        });
    }
    //查找圈子人为干扰值得常数
    findCircleRankArtificial(cb) {
        pool.query(`select circleRankArtificial from circle_constants`, (err, rows) => {
            cb(err, rows[0].circleRankArtificial);
        });
    }
    //修改圈子活跃值
    circleActivityModify(circleId, cb) {
        async.parallel({
            //作品数
            workCnt: (callback) => {
                async.parallel({
                    videoCnt: (callback1) => {
                        pool.query(`select count(1) count from circle_video cv where cv.circleId = ? and cv.status = 1`, [circleId], (err, rows) => {
                            callback1(err, rows[0].count);
                        })
                    },
                    articleCnt: (callback1) => {
                        pool.query(`select count(1) count from circle_article ca where ca.circleId = ? and ca.status = 1`, [circleId], (err, rows) => {
                            callback1(err, rows[0].count);
                        })
                    },
                    topicCnt: (callback1) => {
                        pool.query(`select count(1) count from circle_topic ct where ct.circleId = ? and ct.status = 1`, [circleId], (err, rows) => {
                            callback1(err, rows[0].count);
                        })
                    }
                }, (err, rs) => {
                    callback(err, rs.articleCnt + rs.topicCnt + rs.videoCnt);
                })
            },
            //成员数
            userCnt: (callback) => {
                pool.query(`select count(1) count from circle_user_mid cum where cum.circleId = ?`, [circleId], (err, rows) => {
                    callback(err, rows[0].count);
                });
            },
            //圈子成员活跃值
            avgActivity: (callback) => {
                pool.query(`select avg(cum.activity) count from circle_user_mid cum where cum.circleId = ? and cum.status = 1`, [circleId], (err, rows) => {
                    callback(err, rows[0].count);
                });
            },
            //圈子成立的时间
            createAt: (callback) => {
                pool.query(`select createAt from circle where status = 1 and id = ?`, [circleId], (err, rows) => {
                    callback(err, rows[0] ? rows[0].createAt : '');
                });
            }
        }, (err, results) => {
            //圈子活跃值=作品数(每新增一条视频和文章+5活跃值)+成员数(每新增一位成员+5活跃值)+圈子成员活跃值的平均值;
            // 圈子活跃值实时更新,每月会进行递减15%;
            let circleActivity = results.workCnt * 5 + results.userCnt * 5 + results.avgActivity;
            let now = new Date().getTime();
            let months = Math.floor((now - results.createAt) / (30 * 24 * 60 * 60 * 1000));
            circleActivity = circleActivity * Math.pow((1 - 0.15), months);
            this.updateByOthers({ id: circleId, status: 1 }, { activity: circleActivity }, (err, rs1) => {
                cb(err, rs1);
            });
        });
    }
};
const CircleDaoProxy = new Proxy(new CircleDao({ tableName: "circle" }), {
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
Object.freeze(CircleDaoProxy);
module.exports = CircleDaoProxy;
