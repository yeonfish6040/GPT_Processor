const mysql = require('mysql');
const config = require('../config_GPT_Processor.json');

const conn = mysql.createConnection({
    host: config.DB.Host,
    user: config.DB.User,
    password: config.DB.Password,
    database: config.DB.Database
});
conn.connect((err) => {
    if (err) throw err;

    console.info("DB connected")
});

let testQuery = [];
testQuery.push("SELECT * FROM `GPT_Processor_Conversations`");
testQuery.push("INSERT INTO `GPT_Processor_Conversations` (`uid`, `role`, `content`, `time`) values ('test', 'test', 'test', UNIX_TIMESTAMP())");
testQuery.push("SELECT * FROM `GPT_Processor_Conversations`");
testQuery.push("DELETE FROM `GPT_Processor_Conversations` WHERE `uid` = 'test'");

testQuery.forEach((query) => {
    conn.query(query, (err, result) => {
        if (err) throw err;

        console.log(result.hasOwnProperty('affectedRows') ? result.affectedRows : result[0]);
    });
});