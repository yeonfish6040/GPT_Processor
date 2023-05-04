// Socket io
const SocketIO = require("socket.io")

// file manager
const path = require("path")
const fs = require("fs")

// WebServer
let port = 17002

const https = require("https")
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")

let app = express()
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/img", express.static(path.join(__dirname, 'static/img')));
app.use("/js", express.static(path.join(__dirname, 'static/js')));
app.use("/css", express.static(path.join(__dirname, 'static/css')));
app.get("", (req, res) => res.render("index"));

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