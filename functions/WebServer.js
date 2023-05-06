// Socket io
const SocketIO = require("socket.io")

// file manager
const path = require("path")
const fs = require("fs")

// request
const { request } = require('undici');

// DB
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

// WebServer
let port = 18001

const https = require("https")
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")


let app = express()
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('views', path.join(__dirname, 'web/views'));
app.use("/img", express.static(path.join(__dirname, 'web/static/img')));
app.use("/js", express.static(path.join(__dirname, 'web/static/js')));
app.use("/css", express.static(path.join(__dirname, 'web/static/css')));

app.get("", (req, res) => res.render("index"));

app.get("/connectDriver", async (req, res) => {
    if (req.query.code && req.query.state) {
        const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.Discord.Id,
                client_secret: config.Discord.Secret,
                code: req.query.code,
                grant_type: 'authorization_code',
                redirect_uri: `https://lyj.kr:18001/connectDriver`,
                scope: 'identify',
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        let oauthData = await tokenResponseData.body.json();
        let userResult = await request('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${oauthData.token_type} ${oauthData.access_token}`,
            },
        });
        userResult = await userResult.body.json()
        let query = "SELECT * FROM GPT_Processor_Drivers WHERE `driver` = '" + req.query.state + "'";
        conn.query(query, (err, result) => {
            if (err) throw err;
            if (result.length == 1) conn.query(
                "UPDATE `GPT_Processor_Drivers` SET `driver` = '" + req.query.state + "', `uid` = '" + userResult.id + "' WHERE `driver` = '" + req.query.state + "'"
                , (err, result) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/html' }).end("재연동 성공");
                }
            );
            else conn.query(
                "INSERT INTO `GPT_Processor_Drivers` (`driver`, `uid`) VALUES ('" +req.query.state + "', '"+userResult.id+"')",
                (err, result) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/html' }).end("연동 성공");
                }
            )

        });
    }else
        res.writeHead(400).end()

});

app.get("/img", async (req, res) => {
    let files = fs.readdirSync(path.join(__dirname, "web/static/img/"));
    console.log(files)
    let file = "web/static/img/"+req.query.img;
    if (!fs.existsSync(path.join(__dirname, file))) return res.writeHead(404).end()
    res.writeHead(200, {'Content-Type': 'image/png'}).end(fs.readFileSync(path.join(__dirname, file)));
});

app.server = https.createServer({
    ca: fs.readFileSync(path.join(__dirname, "../cert/fullchain.pem")),
    key: fs.readFileSync(path.join(__dirname, "../cert/privkey.pem")),
    cert: fs.readFileSync(path.join(__dirname, "../cert/cert.pem"))
}, app)

app.io = SocketIO()
app.io.attach(app.server)

module.exports = {
    app: app,
    port: port
}