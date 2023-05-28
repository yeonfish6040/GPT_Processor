"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const openai_1 = require("openai");
const WebServer_1 = require("./functions/WebServer");
const ansi_1 = require("./map/ansi");
const common_1 = require("./learnings/common");
const commands_1 = require("./learnings/commands");
const descriptions_1 = require("./learnings/descriptions");
const req = (0, common_1.common)(commands_1.commands, descriptions_1.descriptions);
const translate_1 = require("./map/translate");
const errMsg = __importStar(require("./map/error"));
const config_GPT_Processor_json_1 = __importDefault(require("./config_GPT_Processor.json"));
const Discord = __importStar(require("discord.js"));
const discord_js_1 = require("discord.js");
const client = new Discord.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.MessageContent
    ],
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: true
    }
});
const koreanbots_1 = require("koreanbots");
let koreanbots = new koreanbots_1.Koreanbots({
    api: {
        token: config_GPT_Processor_json_1.default.KoreanBots.Token
    },
    clientID: config_GPT_Processor_json_1.default.Discord.Id
});
let update = (servers) => {
    var _a;
    return koreanbots.mybot.update({ servers, shards: (_a = client.shard) === null || _a === void 0 ? void 0 : _a.count })
        .then((res) => res.code === 304 ? console.log("Error while updating server count. code 304") : console.log("Server count updated.", JSON.stringify(res)))
        .catch(console.error);
};
const configuration = new openai_1.Configuration({
    apiKey: config_GPT_Processor_json_1.default.OpenAI.API_KEY,
});
const openai = new openai_1.OpenAIApi(configuration);
const chartjs = require("chart.js");
const { JSDOM } = require("jsdom");
let uptime;
client.on(discord_js_1.Events.ClientReady, () => {
    uptime = Date.now();
    console.log("Bot started at " + new Date(uptime).toLocaleString() + " as " + client.user.tag);
    try {
        update(client.guilds.cache.size);
        setInterval(update, 60000, client.guilds.cache.size);
    }
    catch (e) {
    }
});
client.on(discord_js_1.Events.MessageCreate, onMessage);
client.login(config_GPT_Processor_json_1.default.Discord.Token);
// functions
const runPrompt = (messages) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0,
        }).then((res) => {
            resolve(res);
        }).catch((err) => {
            reject(err.toJSON());
        });
    });
});
const getIntent = (message) => {
    return new Promise((resolve, reject) => {
        runPrompt(req(message)).then((res) => {
            let jsonReg = /{\s*"command"\s*:\s*"[^"]*"\s*(,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*)?}/g;
            let response = res.data.choices[0].message.content;
            console.log(response);
            let responseJSONString = jsonReg.exec(response);
            if (responseJSONString == null || responseJSONString.length === 0) {
                if (response == null || response.length === 0) {
                    reject(503);
                    console.log(res);
                }
                else {
                    return resolve({ command: "message.common", characteristic: { text: response } });
                }
            }
            let responseJSON;
            try {
                responseJSON = JSON.parse(responseJSONString[0]);
            }
            catch (e) {
                reject(500);
                console.log(e);
            }
            resolve(responseJSON);
        }).catch((e) => {
            reject(500);
            console.log(e);
        });
    });
};
const bulkDelete = (message, messageList, log = true) => {
    return new Promise((resolve, reject) => {
        message.channel.bulkDelete(messageList, true).then((messages) => {
            if (log)
                message.channel.send((0, ansi_1.ansify)(`${(0, ansi_1.ansiCode)("green")}메시지 ${messages.size}개를 삭제하였습니다.${(0, ansi_1.ansiCode)("reset")}`)).then((msg) => setTimeout(() => msg.delete(), 2000));
            resolve(messages.size);
        }).catch((err) => {
            if (log)
                message.channel.send(errMsg.message_delete()).then((msg) => setTimeout(() => msg.delete(), 2000));
            reject(err);
        });
    });
};
const gotError = (message, msg) => __awaiter(void 0, void 0, void 0, function* () {
    yield message.reactions.resolve("✅").users.remove(config_GPT_Processor_json_1.default.Discord.Id);
    yield message.react("❌");
    yield message.reply(msg).then((msg) => setTimeout(() => msg.delete(), 2000));
});
const randomColor = () => {
    return `#${(Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0')).toString()}`;
};
const range = (start, end) => {
    if (start === end)
        return [start];
    return [start, ...range(start + 1, end)];
};
let cpuUsages = [];
let memoryUsages = [];
const logUsage = () => {
    let total = Object.values(os.cpus()[0].times).reduce((acc, tv) => acc + tv, 0);
    let usage = process.cpuUsage();
    let currentCPUUsage = (usage.user + usage.system);
    cpuUsages.push(Number((currentCPUUsage / total * 100).toFixed(3)));
    const { rss, heapTotal, heapUsed } = process.memoryUsage();
    memoryUsages.push(Number((rss / os.totalmem() * 100).toFixed(3)));
    if (cpuUsages.length > 1000)
        cpuUsages.shift();
    if (memoryUsages.length > 1000)
        memoryUsages.shift();
};
// handlers
/**
 * conversation: {
 *   (userID): {
 *       messages: [
 *           { role: "user", content: "message" },
 *           { role: "assistant", content: "message" },
 *       ],
 *       lastTime: "",
 *   },
 * }
 */
let conversation = {};
function onMessage(message) {
    return __awaiter(this, void 0, void 0, function* () {
        let Channel = message.channel;
        if (message.author.bot)
            return;
        if (message.channel.type)
            return;
        if (message.content === "야 => 대화 초기화") {
            conversation[message.author.id] = { messages: [], lastTime: Date.now() };
            return message.reply("완료했습니다!");
        }
        if (message.content.startsWith(config_GPT_Processor_json_1.default.Discord.Prefix)) {
            let bot_permission = message.guild.members.cache.find((member) => member.user.id === config_GPT_Processor_json_1.default.Discord.Id).roles.highest.permissions;
            try {
                const userMsg = message.content.slice(config_GPT_Processor_json_1.default.Discord.Prefix.length).trim();
                console.log(message.author.id + " | " + message.author.username + "#" + message.author.discriminator + ": " + userMsg);
                yield message.react("🌀");
                if (!conversation[message.author.id])
                    conversation[message.author.id] = { messages: [], lastTime: Date.now() };
                conversation[message.author.id].lastTime = Date.now();
                conversation[message.author.id]["messages"].push({ role: "user", content: userMsg });
                let res;
                try {
                    res = yield getIntent(conversation[message.author.id]["messages"]);
                    yield message.react("✅");
                    yield message.reactions.resolve("🌀").users.remove(config_GPT_Processor_json_1.default.Discord.Id);
                    conversation[message.author.id]["messages"].push({ role: "assistant", content: JSON.stringify(res) });
                }
                catch (e) {
                    yield message.react("✅");
                    yield message.reactions.resolve("🌀").users.remove(config_GPT_Processor_json_1.default.Discord.Id);
                    if (e === 503)
                        return yield gotError(message, errMsg.general(`\n${(0, ansi_1.ansiCode)("red")}그런데.. 이번에는 오류가 아니라 GPT가 대답을 못했네요...?${(0, ansi_1.ansiCode)("reset")})`));
                    else if (e === 500)
                        return yield gotError(message, errMsg.general());
                }
                let controller = (res) => __awaiter(this, void 0, void 0, function* () {
                    switch (res.command) {
                        case "system.reset":
                            conversation[message.author.id] = { messages: [], lastTime: Date.now() };
                            yield message.reply("완료했습니다!");
                            break;
                        case "system.info":
                            let now = Date.now();
                            let uptimeFixed = now - uptime;
                            let uptimeString = `${Math.floor(uptimeFixed / 1000 / 60 / 60)}시간 ${Math.floor(uptimeFixed / 1000 / 60) % 60}분 ${Math.floor(uptimeFixed / 1000) % 60}초`;
                            let memoryUsage = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`;
                            let canvas = new JSDOM("<canvas></canvas>");
                            let dom = canvas.window.document;
                            let ctx = dom.querySelector("canvas").getContext("2d");
                            // best quality
                            ctx.canvas.width = 1200;
                            ctx.canvas.height = 600;
                            let data = {
                                labels: range(1, cpuUsages.length),
                                datasets: [
                                    {
                                        type: "line",
                                        label: "CPU",
                                        data: cpuUsages,
                                        borderColor: "blue",
                                        backgroundColor: "rgba(0, 0, 255, 0.2)",
                                        borderWidth: 1,
                                    },
                                    {
                                        type: "line",
                                        label: "Memory",
                                        data: memoryUsages,
                                        borderColor: "red",
                                        backgroundColor: "rgba(255, 0, 0, 0.2)",
                                        borderWidth: 1,
                                    },
                                    // {
                                    //     type: "bar",
                                    //     label: "CPU",
                                    //     data: cpuUsages,
                                    //     borderColor: "blue",
                                    //     backgroundColor: "rgba(0, 0, 255, 0.2)",
                                    //     borderWidth: 1,
                                    //     fill: "origin"
                                    // },
                                    // {
                                    //     type: "bar",
                                    //     label: "Memory",
                                    //     data: memoryUsages,
                                    //     borderColor: "red",
                                    //     backgroundColor: "rgba(255, 0, 0, 0.2)",
                                    //     borderWidth: 1,
                                    //     fill: "origin"
                                    // }
                                ]
                            };
                            let options = {
                                radius: 0,
                                plugins: {
                                    title: {
                                        display: true,
                                        text: 'CPU, Memory Usage (%)'
                                    },
                                    customCanvasBackgroundColor: {
                                        color: 'white',
                                    }
                                },
                                scales: {
                                    y: {
                                        min: 0,
                                        max: 100,
                                        stepSize: 10
                                    }
                                }
                            };
                            new chartjs(ctx, {
                                data: data,
                                options: options
                            });
                            let img = dom.querySelector("canvas").toDataURL().replace(/^data:image\/png;base64,/, "");
                            let filename = `chart_usage_${Date.now()}.png`;
                            fs.writeFileSync(path.join(__dirname, `functions/web/static/img/${filename}`), img, "base64");
                            let info = new discord_js_1.EmbedBuilder()
                                .setTitle("봇 정보")
                                .addFields({ name: "봇", value: client.user.tag, inline: true }, { name: "모듈", value: "OpenAI GPT 3.5 turbo", inline: true }, { name: "서버 수", value: client.guilds.cache.size.toString(), inline: true })
                                .addFields({ name: "업타임", value: uptimeString, inline: true }, { name: "웹소켓 핑", value: client.ws.ping.toString() + "ms", inline: true }, { name: "메모리 사용량", value: memoryUsage, inline: true })
                                .setTimestamp()
                                .setColor(randomColor())
                                .setImage("https://lyj.kr:18001/img/" + filename)
                                .setFooter({ text: "봇 정보", iconURL: client.user.avatarURL() });
                            yield message.reply({ embeds: [info] });
                            break;
                        case "message.common":
                            yield message.reply(res.characteristic.text);
                            break;
                        case "message.delete":
                            console.log(Channel.permissionsFor(message.author));
                            // check if user has permission
                            if (!Channel.permissionsFor(message.author).has(discord_js_1.PermissionsBitField.Flags.ManageMessages))
                                return yield gotError(message, errMsg.permission.user(translate_1.translate.ManageMessages));
                            if (!Channel.permissionsFor(client.user).has(discord_js_1.PermissionsBitField.Flags.ManageMessages))
                                return yield gotError(message, errMsg.permission.bot(translate_1.translate.ManageMessages));
                            try {
                                let messageList = yield message.channel.messages.fetch();
                                if (res.characteristic.hasOwnProperty("count")) {
                                    if (res.characteristic.count === "all") {
                                        const deleteAll = () => __awaiter(this, void 0, void 0, function* () {
                                            let count = yield bulkDelete(message, messageList, false);
                                            let delCount = count;
                                            while (delCount !== 0) {
                                                delCount = yield bulkDelete(message, yield message.channel.messages.fetch(), false);
                                                count += delCount;
                                            }
                                            return count;
                                        });
                                        let count = yield deleteAll();
                                        return message.channel.send((0, ansi_1.ansify)(`${(0, ansi_1.ansiCode)("green")}총 ${count}개의 메시지를 삭제했습니다.${(0, ansi_1.ansiCode)("reset")}`));
                                    }
                                    // slice collection
                                    messageList = messageList.toJSON().slice(0, Number(res.characteristic.count));
                                    if (res.characteristic.hasOwnProperty("user")) {
                                        if (!isNaN(Number(res.characteristic.user)))
                                            messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                        else
                                            messageList = messageList.filter((msg) => msg.author.username === res.characteristic.user);
                                        yield bulkDelete(message, messageList);
                                    }
                                    else if (res.characteristic.hasOwnProperty("content")) {
                                        messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                        yield bulkDelete(message, messageList);
                                    }
                                    else if (res.characteristic.hasOwnProperty("role")) {
                                        messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                        yield bulkDelete(message, messageList);
                                    }
                                    else {
                                        yield bulkDelete(message, Number(res.characteristic.count));
                                    }
                                }
                                else if (res.characteristic.hasOwnProperty("user")) {
                                    messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                    yield bulkDelete(message, messageList);
                                }
                                else if (res.characteristic.hasOwnProperty("content")) {
                                    messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                    yield bulkDelete(message, messageList);
                                }
                                else if (res.characteristic.hasOwnProperty("role")) {
                                    messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                    yield bulkDelete(message, messageList);
                                }
                            }
                            catch (e) {
                                console.error(e);
                                yield gotError(message, errMsg.general());
                            }
                            break;
                        case "user.check_permission":
                            try {
                                let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                                let member = message.guild.members.cache.find((member) => member.user.id === uid);
                                let role = member.roles.highest;
                                let rolePermissions = role.permissions.serialize();
                                let channel_permissions = Channel.permissionsFor(uid).serialize();
                                let permission = `서버: ${message.guild.name}\n채널: <#${message.channel.id}>\n최고 권한: ${role.name}\n`;
                                permission += `서버 | 채널\n`;
                                permission += `${Object.entries(channel_permissions).map(([k, v]) => ` ${rolePermissions[k] ? "✅" : "❌"} \\|\\|\\| ${v ? "✅" : "❌"} - ${translate_1.translate[k]}`).join('\n')}`;
                                let embed = new discord_js_1.EmbedBuilder()
                                    .setTitle(`${member.user.tag}님의 권한 목록`)
                                    .setDescription(permission)
                                    .setTimestamp();
                                message.reply({ embeds: [embed] });
                            }
                            catch (e) {
                                yield gotError(message, errMsg.general());
                            }
                            break;
                        case "user.kick":
                            if (!Channel.permissionsFor(message.author).has(discord_js_1.PermissionsBitField.Flags.KickMembers))
                                return yield gotError(message, errMsg.permission.user(translate_1.translate.KickMembers));
                            if (!bot_permission.has(discord_js_1.PermissionsBitField.Flags.KickMembers))
                                return yield gotError(message, errMsg.permission.bot(translate_1.translate.KickMembers));
                            try {
                                let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                                let member = message.guild.members.cache.find((member) => member.user.id === uid);
                                yield member.kick(res.characteristic.reason);
                                yield message.reply("완료했습니다!");
                            }
                            catch (e) {
                                yield gotError(message, errMsg.general());
                            }
                            break;
                        case "user.ban":
                            if (!Channel.permissionsFor(message.author).has(discord_js_1.PermissionsBitField.Flags.BanMembers))
                                return yield gotError(message, errMsg.permission.user(translate_1.translate.BanMembers));
                            if (!bot_permission.has(discord_js_1.PermissionsBitField.Flags.BanMembers))
                                return yield gotError(message, errMsg.permission.bot(translate_1.translate.BanMembers));
                            try {
                                let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                                if (res.characteristic.unban === "false") {
                                    let member = message.guild.members.cache.find((member) => member.user.id === uid);
                                    yield member.ban();
                                }
                                else {
                                    yield message.guild.members.unban(client.users.cache.get(uid));
                                }
                                yield message.reply("완료했습니다!");
                            }
                            catch (e) {
                                console.error(e);
                                yield gotError(message, errMsg.general());
                            }
                            break;
                        case "user.mute":
                            if (!Channel.permissionsFor(message.author).has(discord_js_1.PermissionsBitField.Flags.MuteMembers))
                                return yield gotError(message, errMsg.permission.user(translate_1.translate.MuteMembers));
                            if (!bot_permission.has(discord_js_1.PermissionsBitField.Flags.ManageRoles))
                                return yield gotError(message, errMsg.permission.bot(translate_1.translate.ManageRoles));
                            let role = message.guild.roles.cache.find((role) => role.name === "Muted");
                            if (!role) {
                                try {
                                    yield message.guild.roles.create({
                                        name: "Muted",
                                        color: "#000000",
                                        permissions: []
                                    });
                                    message.guild.channels.cache.forEach((channel) => __awaiter(this, void 0, void 0, function* () {
                                        const mutedRole = yield channel.guild.roles.cache.find((role) => role.name === 'Muted');
                                        yield channel.permissionOverwrites.create(mutedRole, {
                                            SendMessages: false
                                        });
                                    }));
                                    role = yield message.guild.roles.cache.find((role) => role.name === "Muted");
                                }
                                catch (e) {
                                    return yield gotError(message, errMsg.general("Muted 역할생성에 실패하였습니다"));
                                }
                            }
                            try {
                                let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                                if (res.characteristic.isMute == "true") {
                                    if (message.guild.members.cache.get(uid).roles.cache.find(role => role.name === "Muted"))
                                        return yield gotError(message, "이미 뮤트된 유저입니다!");
                                    yield message.guild.members.cache.get(uid).roles.add(role);
                                    yield message.reply("완료했습니다!");
                                }
                                else {
                                    if (!message.guild.members.cache.get(uid).roles.cache.find(role => role.name === "Muted"))
                                        return yield gotError(message, "뮤트된 유저가 아닙니다!");
                                    yield message.guild.members.cache.get(uid).roles.remove(role);
                                    yield message.reply("완료했습니다!");
                                }
                            }
                            catch (e) {
                                yield gotError(message, errMsg.general("유저 역할을 수정하는 도중 오류가 발생하였습니다."));
                                console.log(e);
                            }
                            break;
                        case "util.timer":
                            let time = Number(res.characteristic.time);
                            if (isNaN(time))
                                return yield gotError(message, "올바른 형식의 시간이 아닙니다!");
                            setTimeout(() => {
                                let embed = new discord_js_1.EmbedBuilder()
                                    .setTitle("타이머")
                                    .setDescription(`타이머가 종료되었어요!\n${time / 1000}초 만큼 지났어요!`)
                                    .setColor(randomColor())
                                    .setTimestamp();
                                message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
                            }, time);
                            let embedNotice = new discord_js_1.EmbedBuilder()
                                .setTitle("타이머")
                                .setDescription(`타이머가 설정되었어요!\n${time / 1000}초 후에 멘션해드릴게요!`)
                                .setColor(randomColor())
                                .setTimestamp();
                            yield message.reply({ embeds: [embedNotice] });
                            break;
                    }
                });
                yield controller(res);
            }
            catch (e) {
                console.error(e);
            }
        }
    });
}
// Logger
logUsage();
setInterval(logUsage, 1000);
// Web Server
WebServer_1.application.server.listen(WebServer_1.port, () => {
    console.log(`Express Https Server is running on port ${WebServer_1.port}`);
});
