// Socket io
const SocketIO = require("socket.io")

// file manager
const path = require("path")
const fs = require("fs")

// Crypto
const crypto = require("crypto")

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

app.get("/connect/driver", async (req, res) => {
    if (req.query.code && req.query.state) {
        const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.Discord.Id,
                client_secret: config.Discord.Secret,
                code: req.query.code,
                grant_type: 'authorization_code',
                redirect_uri: `https://lyj.kr:18001/connect/driver`,
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
        let query = "SELECT * FROM GPT_Processor_Drivers WHERE `driver` = '{0}' OR `uid` = '{1}'".format(req.query.state, userResult.id);
        conn.query(query, (err, result) => {
            if (err) throw err;
            if (result.length == 1) conn.query(
                "UPDATE `GPT_Processor_Drivers` SET `driver` = '{0}', `uid` = '{1}' WHERE `uid` = '{2}'".format(req.query.state, userResult.id, userResult.id)
                , (err, result) => {
                    if (err) throw err;
                    res.writeHead(200, { 'Content-Type': 'text/html' }).end("재연동 성공");
                }
            );
            else conn.query(
                "INSERT INTO `GPT_Processor_Drivers` (`driver`, `uid`) VALUES ('{0}', '{1}')".format(req.query.state, userResult.id),
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
    files.forEach((file) => {
        if (Date.now()-parseInt(file.split("_")[file.length-1]) > 1209600)
            fs.unlinkSync(path.join(__dirname, "web/static/img/"+file));
    })
    let file = "web/static/img/"+req.query.img;
    if (!fs.existsSync(path.join(__dirname, file))) return res.writeHead(404).end()
    res.writeHead(200, {'Content-Type': 'image/png'}).end(fs.readFileSync(path.join(__dirname, file)));
});

app.post("/check/driver", (req, res) => {
    if (req.body.uuid) {
        let query = "SELECT * FROM `GPT_Processor_Drivers` where `driver` = '{0}'".format(req.body.uuid);
        conn.query(query, (err, result) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end(result.length == 1 ? "true" : "false")
        })
    }else
        res.writeHead(422).end()
})

app.post("/check/token", (req, res) => {
    if (req.body.uuid) {
        let query = "SELECT * FROM `GPT_Processor_Drivers` where `driver` = '{0}'".format(req.body.uuid);
        console.log(query)
        conn.query(query, (err, result) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end(result[0].token ? "true" : "false")
        })
    }else
        res.writeHead(422).end()
});

app.post("/set/token", (req, res) => {
    if (req.body.token && req.body.uuid) {
        let query = "UPDATE GPT_Processor_Drivers SET `token` = '{0}' WHERE `driver` = '{1}'".format(req.body.token, req.body.uuid);
        conn.query(query, (err, result) => {
            if (err) res.writeHead(500).end()
            else res.writeHead(200).end()
        })
    }else
        res.writeHead(422).end()
});

app.post("/crypto/keypair", (req, res) => {
    let key;
    try {
        key = keypair(req.body.passphrase)
    }catch (e) {
        res.status(500).json({ error: e.toString() })
    }
    res.status(200).json({ publicKey: key.publicKey, privateKey: key.privateKey })
});

app.post("/crypto/encrypt", (req, res) => {
    let encrypted
    try {
        encrypted = encrypt(req.body.publicKey, req.body.text)
    }catch (e) {
        res.status(500).json({ error: e.toString() })
    }

    res.json({ encrypted: encrypted.toString("base64") })
})
app.post("/crypto/decrypt", (req, res) => {
    let decrypted
    try {
        let key = crypto.createPrivateKey({
            key: req.body.privateKey,
            format: "pem",
            passphrase: req.body.passphrase || "default"
        });

        decrypted = decrypt(key, req.body.text, req.body.passphrase)
    }catch (e) {
        res.status(500).json({ error: e.toString() })
    }
    res.json({ decrypted: decrypted.toString("utf-8") })
})

app.server = https.createServer({
    ca: fs.readFileSync(path.join(__dirname, "../cert/fullchain.pem")),
    key: fs.readFileSync(path.join(__dirname, "../cert/privkey.pem")),
    cert: fs.readFileSync(path.join(__dirname, "../cert/cert.pem"))
}, app)

app.io = SocketIO()
app.io.attach(app.server)

let sockets = {}
let keypairs = {}
app.io.on("connection", (socket) => {
    socket.on('connectDriver', (uuid) => {
        let query = "SELECT * FROM GPT_Processor_Drivers WHERE `driver` = '{0}'".format(uuid);
        console.log(query)
        conn.query(query, (err, result) => {
            if (err) throw err;
            if (result.length == 1) {
                socket.emit("connectDriver", result[0].uid);
                sockets[uuid] = socket;
            } else {
                socket.emit("connectDriver", null);
            }
        });
    })

    socket.on('keypair', (uuid) => {
        try {
            let key = keypair(uuid);
            keypairs[uuid] = key;
            socket.emit("keypair", { publicKey: key.publicKey, privateKey: key.privateKey })
        }catch (e) {
            socket.emit("keypair", { error: e.toString() })
        }
    })
});

String.prototype.format = function () {
    let formatted = this;
    for( let arg in arguments ) {
        formatted = formatted.replace("{" + arg + "}", arguments[arg]);
    }
    return formatted;
};

const keypair = (passphrase) => {
    let key = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: "pkcs1",
            format: "pem"
        },
        privateKeyEncoding: {
            type: "pkcs8", // Key Encoding 방식 type: 'sec1' | 'pkcs8';
            format: "pem",
            cipher: "aes-256-cbc", // 알고리즘
            passphrase: passphrase || "default"
        }
    })
}

const encrypt = (text, publicKey) => {
    return crypto.publicEncrypt(publicKey, Buffer.from(text));
}

const decrypt = (text, privateKey, passphrase=null) => {
    let key = crypto.createPrivateKey({
        key: privateKey,
        format: "pem",
        passphrase: passphrase || "default"
    });

    return crypto.privateDecrypt(key, Buffer.from(text, "base64"));
}

module.exports = {
    app: app,
    port: port,
    encrypt: encrypt,
    decrypt: decrypt,
}