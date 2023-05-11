// DB
const mysql = require('mysql');
const config = require('../config_GPT_Processor.json');

const pool = mysql.createPool({
    host: config.DB.Host,
    user: config.DB.User,
    password: config.DB.Password,
    database: config.DB.Database
});

function getConn() {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {
            if (err) reject(err);
            resolve(conn);
        });
    });
}

module.exports = getConn();