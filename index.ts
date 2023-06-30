import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as worker_threads from "worker_threads";
import type {Worker} from "worker_threads";

import * as types from "./map/types";

import * as interfaces from "./map/interfaces";

import { OpenAIApi, Configuration } from "openai";
import {AxiosResponse} from "axios";

import * as AGPT_constant from "./map/AGPT_constant";

import db from "./functions/db";

import { application as app, port } from "./functions/WebServer";
import { ansify, ansiCode } from "./map/ansi";
import { common } from "./learnings/common";
import { commands } from "./learnings/commands";
import { descriptions } from "./learnings/descriptions";
const req = common(commands, descriptions);

import {translate as permissionTranslation} from "./map/translate";
import * as errMsg from "./map/error";
import config from "./config_GPT_Processor.json";
import type {UpdateResponse} from "koreanbots";

import * as Discord from "discord.js";
import {
    GatewayIntentBits,
    Events,
    PermissionsBitField,
    EmbedBuilder,
    Guild,
    MessageManager,
    Message,
    Awaitable, TextChannel, ColorResolvable, HexColorString, Collection, User, Role, GuildMember} from "discord.js";
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: true
    }
});

import { Koreanbots } from "koreanbots";
import {MysqlError, PoolConnection} from "mysql";
import EmbedManager from "./functions/EmbedManager";
let koreanbots: Koreanbots = new Koreanbots({
    api: {
        token: config.KoreanBots.Token
    },
    clientID: config.Discord.Id
})
let update = (servers: number) => koreanbots.mybot.update({servers, shards: client.shard?.count})
    .then((res: UpdateResponse) => res.code == 304 ? null : console.log("Server count updated.", JSON.stringify(res)))
    .catch(console.error)

const configuration = new Configuration({
    apiKey: config.OpenAI.API_KEY,
});
const openai = new OpenAIApi(configuration);

import * as chartjs from "chart.js";
import { JSDOM } from "jsdom";

let uptime: number;
client.on(Events.ClientReady, () => {
    uptime = Date.now();
    console.log("Bot started at " + new Date(uptime).toLocaleString() + " as " + client.user!.tag);

    try {
        update(client.guilds.cache.size);
        setInterval(update, 60000, client.guilds.cache.size);
    } catch (e) {
    }
});

client.on(Events.MessageCreate, onMessage);

client.login(config.Discord.Token);

// functions
const runPrompt = async (messages: types.conversations): Promise<AxiosResponse> => {
    return new Promise((resolve, reject) => {
        openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 1,
        }).then((res: AxiosResponse) => {
            resolve(res);
        }).catch((err) => {
            reject(err.toJSON());
        });
    })
}

const getIntent = (msg: Message, message: types.conversations): Promise<Array<types.command>> => {
    return new Promise((resolve, reject) => {
        runPrompt(req(msg, message)).then((res: AxiosResponse) => {
            let jsonReg = /\[({\s*"command"\s*:\s*"[^"]*"\s*(,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*)?}[ ]*[,]?[ ]*)+\]/g
            let response = res.data.choices[0].message.content
            console.log(response)
            let responseJSONString = jsonReg.exec(response);
            if (responseJSONString == null || responseJSONString.length === 0) {
                if (response == null || response.length === 0) {
                    reject(503);
                    console.error("OpenAI_no-response", res);
                }else {
                    return resolve([{ command: "message.common", characteristic: { text: response } }]);
                }
            }
            let responseJSON;
            try {
                responseJSON = JSON.parse(responseJSONString![0]);
            } catch (e) {
                reject(500);
                console.error(e);
            }
            resolve(responseJSON);
        }).catch((e) => {
            reject(500);
            console.error(e);
        })
    });
}

const bulkDelete = (message: Message, messageList: Collection<string, Message<boolean>>|Message<boolean>[]|number, log = true): Promise<number> => {
    return new Promise((resolve, reject) => {
        (message.channel as TextChannel).bulkDelete(messageList, true).then((messages) => {
            if (log)
                (message.channel as TextChannel).send(ansify(`${ansiCode("green")}메시지 ${messages.size}개를 삭제하였습니다.${ansiCode("reset")}`)).then((msg) => setTimeout(() => msg.delete(), 2000));
            resolve(messages.size);
        }).catch((err) => {
            if (log)
                message.channel.send(errMsg.message_delete()).then((msg) => setTimeout(() => msg.delete(), 2000));
            reject(err);
        })
    });
}

const gotError = async (message: Message, msg: string) => {
    await message.channel.send(msg).then((msg) => setTimeout(() => msg.delete(), 5000));
}

const randomColor = (): HexColorString => {
    return `#${(Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0')).toString()}`;
}

const range = (start: number, end: number): Array<number> => {
    let arr: Array<number> = [];
    for (let i:number=start;i<=end;i++)
        arr.push(i);
    return arr;
}

const format = function (formatted: string, ...args: string[]): string {
    for(let arg in args) {
        formatted = formatted.replace("{" + arg + "}", args[arg]);
    }
    return formatted;
};

let cpuUsages: number[] = [];
let memoryUsages: number[] = [];
const logUsage = () => {
    let total = Object.values(os.cpus()[0].times).reduce(
        (acc, tv) => acc + tv, 0
    );
    let usage = process.cpuUsage();
    let currentCPUUsage = (usage.user + usage.system) / 1000;
    cpuUsages.push(Number((currentCPUUsage / total * 100).toFixed(3)));
    const {rss, heapTotal, heapUsed} = process.memoryUsage()
    memoryUsages.push(Number((rss / os.totalmem() * 100).toFixed(3)));
    if (cpuUsages.length > 10000)
        cpuUsages.shift();
    if (memoryUsages.length > 10000)
        memoryUsages.shift();
}

const killThread = async (worker: Worker, message: Message) => {
    let process = path.join(__dirname, "/functions/AGPT_processes/" + message.author.id + ".json");
    if (fs.existsSync(process)) {
        fs.unlinkSync(process);
    }
    worker.terminate();
}

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
let conversation: types.userConversations = {};

async function onMessage(message: Message): Promise<any> {
    let Channel = message.channel as TextChannel;

    if (message.author.bot) return;
    if (message.channel.type) return;
    if (message.content.trim() == "야") return;



    if (message.content === "야 => 대화 초기화") {
        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
        return message.reply("완료했습니다!");
    }

    if (message.content.startsWith(config.Discord.Prefix+" ")) {
        let bot_permission = message.guild!.members.cache.find((member) => member.user.id === config.Discord.Id)!.roles.highest.permissions;
        try {
            const userMsg = message.content.slice(config.Discord.Prefix.length).trim();
            console.log(message.author.id + " | " + message.author.username + "#" + message.author.discriminator + ": " + userMsg)
            message.channel.sendTyping();
            if (!conversation[message.author.id])
                conversation[message.author.id] = {messages: [], lastTime: Date.now()};
            conversation[message.author.id].lastTime = Date.now();
            conversation[message.author.id]["messages"].push({role: "user", content: userMsg});
            let res: Array<types.command>|undefined;
            try {
                res = await getIntent(message, conversation[message.author.id]["messages"]);
                conversation[message.author.id]["messages"].push({role: "assistant", content: JSON.stringify(res)});
            } catch (e) {
                if (e === 503)
                    return await gotError(message, errMsg.general(`\n${ansiCode("red")}이유요? 대답할 말을 찾지 못했어요...${ansiCode("reset")})`))
                else if (e === 500)
                    return await gotError(message, errMsg.general())
            }
            let controller = async (res: types.command) => {
                switch (res.command) {
                    case "system.reset":
                        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        await message.reply("완료했습니다!")
                        break;
                    case "system.info":
                        let now = Date.now();
                        let uptimeFixed = now - uptime;
                        let uptimeString = `${Math.floor(uptimeFixed / 1000 / 60 / 60)}시간 ${Math.floor(uptimeFixed / 1000 / 60) % 60}분 ${Math.floor(uptimeFixed / 1000) % 60}초`
                        let memoryUsage = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`

                        let canvas = new JSDOM("<canvas></canvas>");
                        let dom = canvas.window.document;
                        let ctx = dom.querySelector("canvas")!.getContext("2d")!;
                        // best quality
                        ctx.canvas.width = 1200;
                        ctx.canvas.height = 600;
                        let data: chartjs.ChartData = {
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
                                }
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
                        new chartjs.Chart(ctx, {
                            type: "line",
                            data: data,
                            options: options
                        })
                        let img = dom.querySelector("canvas")!.toDataURL().replace(/^data:image\/png;base64,/, "");
                        let filename = `chart_usage_${Date.now()}.png`;
                        fs.writeFileSync(path.join(__dirname, `functions/web/static/img/${filename}`), img, "base64");
                        let info = new EmbedBuilder()
                            .setTitle("봇 정보")
                            .addFields(
                                {name: "봇", value: client.user!.tag, inline: true},
                                {name: "모듈", value: "OpenAI GPT 3.5 turbo", inline: true},
                                {name: "서버 수", value: client.guilds.cache.size.toString(), inline: true},
                            )
                            .addFields(
                                {name: "업타임", value: uptimeString, inline: true},
                                {name: "웹소켓 핑", value: client.ws.ping.toString() + "ms", inline: true},
                                {name: "메모리 사용량", value: memoryUsage, inline: true},
                            )
                            .setTimestamp()
                            .setColor(randomColor())
                            .setImage("https://lyj.kr:18001/img/" + filename)
                            .setFooter({text: "봇 정보", iconURL: client.user!.avatarURL() as string});
                        await message.reply({embeds: [info]})
                        break;

                    case "message.common":
                        await message.reply(res.characteristic.text);
                        break;
                    case "message.delete":
                        console.log(Channel.permissionsFor(message.author))
                        // check if user has permission
                        if (!Channel.permissionsFor(message.author)!.has(PermissionsBitField.Flags.ManageMessages))
                            return await gotError(message, errMsg.permission.user(permissionTranslation.ManageMessages))
                        if (!Channel.permissionsFor(client.user as User)!.has(PermissionsBitField.Flags.ManageMessages))
                            return await gotError(message, errMsg.permission.bot(permissionTranslation.ManageMessages))
                        try {
                            let messageList: Collection<string, Message<boolean>>|Message<boolean>[] = await message.channel.messages.fetch()
                            if (res.characteristic.hasOwnProperty("count")) {
                                if (res.characteristic.count === "all") {
                                    const deleteAll = async () => {
                                        let count: number = await bulkDelete(message, messageList, false);
                                        let delCount: number = count

                                        while (delCount !== 0) {
                                            delCount = await bulkDelete(message, await message.channel.messages.fetch(), false);
                                            count += delCount;
                                        }
                                        return count;
                                    }
                                    let count = await deleteAll();
                                    return message.channel.send(ansify(`${ansiCode("green")}총 ${count}개의 메시지를 삭제했습니다.${ansiCode("reset")}`));
                                }
                                // slice collection
                                messageList = messageList.toJSON().slice(0, Number(res.characteristic.count));
                                if (res.characteristic.hasOwnProperty("user")) {
                                    if (!isNaN(Number(res.characteristic.user)))
                                        messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                    else
                                        messageList = messageList.filter((msg) => msg.author.username === res.characteristic.user);
                                    return await bulkDelete(message, messageList);
                                } else if (res.characteristic.hasOwnProperty("content")) {
                                    messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                    return await bulkDelete(message, messageList);
                                } else if (res.characteristic.hasOwnProperty("role")) {
                                    messageList = messageList.filter((msg) => msg.member!.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                    return await bulkDelete(message, messageList);
                                } else {
                                    return await bulkDelete(message, Number(res.characteristic.count));
                                }
                            } else if (res.characteristic.hasOwnProperty("user")) {
                                messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                return await bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("content")) {
                                messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                return await bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("role")) {
                                messageList = messageList.filter((msg) => msg.member!.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                return await bulkDelete(message, messageList);
                            }
                        } catch (e) {
                            console.error(e)
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.check_permission":
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)![0];
                            let member = message.guild!.members.cache.find((member) => member.user.id === uid)!;
                            let role = member.roles.highest;
                            let rolePermissions: Record<string, boolean> = role.permissions.serialize();
                            let channel_permissions = Channel.permissionsFor(uid)!.serialize();
                            let permission = `서버: ${message.guild!.name}\n채널: <#${message.channel.id}>\n최고 권한: ${role.name}\n`;
                            permission += `서버 | 채널\n`;
                            permission += `${Object.entries(channel_permissions).map(([k, v]) => ` ${rolePermissions[k] ? "✅" : "❌"} \\|\\|\\| ${v ? "✅" : "❌"} - ${permissionTranslation[k]}`).join('\n')}`;
                            let embed = new EmbedBuilder()
                                .setTitle(`${member.user.tag}님의 권한 목록`)
                                .setDescription(permission)
                                .setTimestamp();
                            message.reply({embeds: [embed]});
                        } catch (e) {
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.kick":
                        if (!Channel.permissionsFor(message.author)!.has(PermissionsBitField.Flags.KickMembers))
                            return await gotError(message, errMsg.permission.user(permissionTranslation.KickMembers))
                        if (!bot_permission.has(PermissionsBitField.Flags.KickMembers))
                            return await gotError(message, errMsg.permission.bot(permissionTranslation.KickMembers))
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)![0];
                            let member = message.guild!.members.cache.find((member) => member.user.id === uid)!;
                            await member.kick(res.characteristic.reason);
                            await message.reply("완료했습니다!")
                        } catch (e) {
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.ban":
                        if (!Channel.permissionsFor(message.author)!.has(PermissionsBitField.Flags.BanMembers))
                            return await gotError(message, errMsg.permission.user(permissionTranslation.BanMembers));
                        if (!bot_permission.has(PermissionsBitField.Flags.BanMembers))
                            return await gotError(message, errMsg.permission.bot(permissionTranslation.BanMembers));
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)![0];
                            if (res.characteristic.unban === "false") {
                                let member = message.guild!.members.cache.find((member) => member.user.id === uid)!;
                                await member.ban();
                            } else {
                                await message.guild!.members.unban(client.users.cache.get(uid) as User);
                            }
                            await message.reply("완료했습니다!");
                        } catch (e) {
                            console.error(e)
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.mute":
                        if (!Channel.permissionsFor(message.author)!.has(PermissionsBitField.Flags.MuteMembers))
                            return await gotError(message, errMsg.permission.user(permissionTranslation.MuteMembers))
                        if (!bot_permission.has(PermissionsBitField.Flags.MuteMembers))
                            return await gotError(message, errMsg.permission.bot(permissionTranslation.MuteMembers))

                        break;
                    case "util.timer":
                        let time: number = Number(res.characteristic.time);
                        if (isNaN(time))
                            return await gotError(message, "올바른 형식의 시간이 아닙니다!");

                        setTimeout(() => {
                            let embed = new EmbedBuilder()
                                .setTitle("타이머")
                                .setDescription(`타이머가 종료되었어요!\n${time / 1000}초 만큼 지났어요!`)
                                .setColor(randomColor())
                                .setTimestamp();
                            message.channel.send({content: `<@${message.author.id}>`, embeds: [embed]})
                        }, time)
                        let embedNotice = new EmbedBuilder()
                            .setTitle("타이머")
                            .setDescription(`타이머가 설정되었어요!\n${time / 1000}초 후에 멘션해드릴게요!`)
                            .setColor(randomColor())
                            .setTimestamp();
                        await message.reply({embeds: [embedNotice]});
                        break;
                    case "AGPT":
                        let embed = new EmbedManager();
                        embed.setTitle("AGPT")
                            .setDescription("AGPT가 요청을 처리중입니다!")
                            .addFields({ name: "상태", value: "정상-진행중", inline: true },
                                { name: "단계", value: "준비중", inline: true }
                            ).setColor(randomColor())
                            .setTimestamp();
                        let msg = await message.reply({embeds: [embed]});
                        embed.setMessage(msg)

                        let worker = new worker_threads.Worker(path.join(__dirname, "/functions/AGPT_core.js"));
                        let room = app.io.sockets.adapter.rooms.get(message.author.id);

                        let NRPC = true
                        let r_process = path.join(__dirname, "/functions/AGPT_processes/"+message.author.id+".json")
                        if (fs.existsSync(r_process) && fs.readFileSync(r_process).toString() !== "")
                                NRPC = false

                        worker.postMessage({ evt: AGPT_constant.parent.tStart, task: res.characteristic.task, uid: message.author.id, socket: room?room.size===1:false, NRPC: NRPC });
                        worker.on("message", async (value) => {
                            console.log(value)
                            switch (value.evt) {
                                case AGPT_constant.child.SDC:
                                    embed
                                        .changeField("단계", "드라이버 확인중")
                                        .edit();
                                    break;
                                case AGPT_constant.child.error.DNC:
                                    embed
                                        .addDescription("드라이버가 소켓서버에 연결되어있지 않음.")
                                        .addDescription("드라이버가 설치되어있는 컴퓨터가 켜져있는지 확인하여 주십시오.")
                                        .changeField("상태", "오류-드라이버가 연결되지 않았습니다.")
                                        .setColor(0xFF0000)
                                        .edit();
                                    killThread(worker, message)
                                    break;
                                case AGPT_constant.child.error.DNF:
                                    embed
                                        .addDescription("드라이버 등록 정보를 찾을 수 없음.")
                                        .addDescription("Help: 드라이버를 설치하거나 드라이버 초기 설정을 완료 후, 다시 시도하여 주십시오.")
                                        .changeField("상태", "오류-드라이버가 계정에 등록되지 않았습니다.")
                                        .setColor(0xFF0000)
                                        .edit();
                                    killThread(worker, message)
                                    break;
                                case AGPT_constant.child.CDR:
                                    embed
                                        .addDescription("드라이버 등록 여부 확인 완료")
                                        .edit();
                                    break;
                                case AGPT_constant.child.CDC:
                                    embed
                                        .addDescription("드라이버 연결 확인 완료")
                                        .edit();
                                    break;
                                case AGPT_constant.child.CPF:
                                    embed
                                        .changeField("단계", "프로세스 파일 확인중")
                                        .edit();
                                    break;
                                case AGPT_constant.child.error.RPE:
                                    embed
                                        .changeField("상태", "오류-진행중인 프로세스가 있습니다.")
                                        .edit();
                                    killThread(worker, message)
                                    break;
                                case AGPT_constant.child.SPP:
                                    embed
                                        .addDescription("진행중인 프로세스 없음.")
                                        .changeField("단계", "프로세스 생성중")
                                        .edit();
                                    let process = path.join(__dirname, `/functions/AGPT_processes/${message.author.id}.json`);
                                    fs.createWriteStream(process).end();
                                    break;
                                case AGPT_constant.child.WGG:
                                    embed
                                        .addDescription(`Goal-${value.index}: ` + value.goal)
                                        .edit();
                                    break;
                                case AGPT_constant.child.SRP:
                                    embed
                                        .addDescription("프로세스 생성 완료")
                                        .changeField("단계", "프로세스 실행중")
                                        .edit();
                                    killThread(worker, message)
                                    break;
                                case AGPT_constant.child.error.OAE:
                                    embed
                                        .addDescription("프로세스 생성 실패")
                                        .addDescription("OpenAI API 오류발생")
                                        .addDescription(value.error)
                                        .changeField("상태", "오류-OpenAI API 오류")
                                        .setColor(0xFF0000)
                                        .edit();
                                    killThread(worker, message)
                                    break;
                                case AGPT_constant.child.PGU:
                                    switch (value.step) {
                                        case AGPT_constant.child.progress.goals:
                                            console.log(value.data)

                                            break;
                                    }
                                    break
                                case AGPT_constant.child.log:
                                    console.log(value.data)
                                    break;
                            }
                        });
                        break;
                }
            }
            res?.forEach((cmd: types.command) => {
                controller(cmd)
            })
        } catch (e) {
            console.error(e)
        }
    }
}

// Logger
logUsage()
setInterval(logUsage, 10000)


// Web Server
app.server.listen(port, () => {
    console.log(`Express Https Server is running on port ${port}`);
});