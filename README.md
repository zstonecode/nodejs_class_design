# nodejs_class_design
nodejs三层基于面向对象设计

## base_dao.js 使用mysql模块提供基础的curd及分页操作，方法中可以添加观察者模式，export这个基础类
## ${tableName}dao.js extends base_dao.js导出的基础类，只需添加表名即可，同时使用es6的代理将这个实例做代理，在这个类中可以写入对于该表的特殊方法
## service层，调用dao层的基础操作，使用async等异步处理库对于复杂业务的处理
## controller层，使用express提供restful规范接口
## router,扫描整个controller文件夹，添加
