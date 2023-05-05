// Socket io
const SocketIO = require("socket.io")

// file manager
const path = require("path")
const fs = require("fs")

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

app.get("connectDriver", (req, res) => {

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