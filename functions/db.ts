// DB
import * as mysql from "mysql";
import * as config from "../config_GPT_Processor.json";
import {Connection, Pool, PoolConnection} from "mysql";

const pool = mysql.createPool({
    host: config.DB.Host,
    user: config.DB.User,
    password: config.DB.Password,
    database: config.DB.Database
});

export function getConn(): Promise<PoolConnection> {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {
            if (err) reject(err);
            resolve(conn);
        });
    });
}