// types
import {Request, Response} from "express";
import * as interfaces from "../map/interfaces";
import * as types from "../map/types";


// file manager
import * as path from "path";
import * as fs from "fs";

// Socket io
import { Server } from "socket.io";
import {Socket} from "socket.io";

// request
import { request, Dispatcher } from "undici";

// DB
import * as config from "../config_GPT_Processor.json";
import {MysqlError} from "mysql";
import db from "./db";

// WebServer
import * as https from "https";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as ejs from "ejs";


export let port = 18001
let app = express.default();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('views', path.join(__dirname, 'web/views'));
app.use("/img", express.static(path.join(__dirname, 'web/static/img')));
app.use("/js", express.static(path.join(__dirname, 'web/static/js')));
app.use("/css", express.static(path.join(__dirname, 'web/static/css')));

app.get("", (req: Request, res: Response) => res.render("index"));

app.get("/link/driver", async (req: Request, res: Response) => {
    if (req.query.code && req.query.state) {
        const tokenResponseData: Dispatcher.ResponseData = await request('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.Discord.Id,
                client_secret: config.Discord.Secret,
                code: req.query.code as string,
                grant_type: 'authorization_code',
                redirect_uri: `https://lyj.kr:18001/link/driver`,
                scope: 'identify',
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        let oauthData = await tokenResponseData.body.json();
        let response: Dispatcher.ResponseData = await request('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${oauthData.token_type} ${oauthData.access_token}`,
            },
        });
        let userResult = await response.body.json()
        let conn = await db();
        let query: string = format("SELECT * FROM GPT_Processor_Drivers WHERE `driver` = '{0}' OR `uid` = '{1}'", req.query.state as string, userResult.id);
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) throw err;
            if (result.length == 1) conn.query(
                format("UPDATE `GPT_Processor_Drivers` SET `driver` = '{0}', `uid` = '{1}' WHERE `uid` = '{2}'", req.query.state as string, userResult.id, userResult.id)
                , (err: MysqlError|null, result: interfaces.driver[]) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/html' }).end("재연동 성공");
                }
            );
            else conn.query(
                format("INSERT INTO `GPT_Processor_Drivers` (`driver`, `uid`) VALUES ('{0}', '{1}')", req.query.state as string, userResult.id),
                (err: MysqlError|null, result: interfaces.driver[]) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/html' }).end("연동 성공");
                }
            )
        });
        conn.release();
    }else
        res.writeHead(400).end()

});

app.get("/img", async (req: Request, res: Response) => {
    let files = fs.readdirSync(path.join(__dirname, "web/static/img/"));
    files.forEach((file) => {
        if (Date.now()-parseInt(file.split("_")[file.length-1]) > 1209600)
            fs.unlinkSync(path.join(__dirname, "web/static/img/"+file));
    })
    let file = "web/static/img/"+req.query.img;
    if (!fs.existsSync(path.join(__dirname, file))) return res.writeHead(404).end()
    res.writeHead(200, {'Content-Type': 'image/png'}).end(fs.readFileSync(path.join(__dirname, file)));
});

app.post("/check/driver", async (req: Request, res: Response) => {
    if (req.body.uuid) {
        let conn = await db();
        let query = format("SELECT * FROM `GPT_Processor_Drivers` where `driver` = '{0}'", req.body.uuid);
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end(result.length == 1 ? "true" : "false")
        })
        conn.release();
    }else
        res.writeHead(422).end()
})

app.post("/check/token/openai", async (req: Request, res: Response) => {
    if (req.body.uuid) {
        let conn = await db();
        let query = format("SELECT * FROM `GPT_Processor_Drivers` where `driver` = '{0}'", req.body.uuid);
        console.log(query)
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end(result[0].openai_token ? "true" : "false")
        })
        conn.release();
    }else
        res.writeHead(422).end()
});

app.post("/check/token/googleSearch", async (req: Request, res: Response) => {
    if (req.body.uuid) {
        let conn = await db();
        let query = format("SELECT * FROM `GPT_Processor_Drivers` where `driver` = '{0}'", req.body.uuid);
        console.log(query)
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end(result[0].googleSearch_token ? "true" : "false")
        })
        conn.release();
    }else
        res.writeHead(422).end()
});


app.post("/set/token/openai", async (req: Request, res: Response) => {
    if (req.body.token && req.body.uuid) {
        let conn = await db();
        let query = format("UPDATE GPT_Processor_Drivers SET openai_token = '{0}' WHERE `driver` = '{1}'", req.body.token, req.body.uuid);
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end()
        })
        conn.release();
    }else
        res.writeHead(422).end()
});

app.post("/set/token/googleSearch", async (req: Request, res: Response) => {
    if (req.body.token && req.body.uuid) {
        let conn = await db();
        let query = format("UPDATE GPT_Processor_Drivers SET googleSearch_token = '{0}' WHERE `driver` = '{1}'", req.body.token, req.body.uuid);
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end()
        })
        conn.release();
    }else
        res.writeHead(422).end()
});

export let application = {
    server: https.createServer({
        ca: fs.readFileSync(path.join(__dirname, "../cert/fullchain.pem")),
        key: fs.readFileSync(path.join(__dirname, "../cert/privkey.pem")),
        cert: fs.readFileSync(path.join(__dirname, "../cert/cert.pem"))
    }, app),
    io: new Server()
}

application.io.attach(application.server)

let sockets: types.sockets = {}
application.io.on("connection", (socket: Socket) => {
    socket.on('linkDriver', async (uuid) => {
        let conn = await db();
        let query = format("SELECT * FROM GPT_Processor_Drivers WHERE `driver` = '{0}'", uuid);
        console.log(query)
        conn.query(query, (err: MysqlError|null, result: interfaces.driver[]) => {
            if (err) throw err;
            if (result.length == 1) {
                socket.emit("linkDriver", result[0].uid);
                socket.join(result[0].uid);
            } else {
                socket.emit("linkDriver", null);
            }
        });
        conn.release();
    });
});

const format = function (formatted: string, ...args: string[]): string {
    for(let arg in args) {
        formatted = formatted.replace("{" + arg + "}", args[arg]);
    }
    return formatted;
};