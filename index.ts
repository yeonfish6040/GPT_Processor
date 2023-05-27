import * as os from "os";
import * as fs from "fs";
import * as path from "path";

import * as types from "./map/types";

import { OpenAIApi, Configuration } from "openai";
import {AxiosResponse} from "axios";

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
    Awaitable, TextChannel, ColorResolvable, HexColorString, Collection, User, Role, GuildMember
} from "discord.js";
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
let koreanbots: Koreanbots = new Koreanbots({
    api: {
        token: config.KoreanBots.Token
    },
    clientID: config.Discord.Id
})
let update = (servers: number) => koreanbots.mybot.update({servers, shards: client.shard?.count})
    .then((res: UpdateResponse) => res.code === 304 ? console.log("Error while updating server count. code 304") : console.log("Server count updated.", JSON.stringify(res)))
    .catch(console.error)

const configuration = new Configuration({
    apiKey: config.OpenAI.API_KEY,
});
const openai = new OpenAIApi(configuration);

const chartjs = require("chart.js");
const {JSDOM} = require("jsdom");

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
            temperature: 0,
        }).then((res: AxiosResponse) => {
            resolve(res);
        }).catch((err) => {
            reject(err.toJSON());
        });
    })
}

const getIntent = (message: types.conversations): Promise<types.command> => {
    return new Promise((resolve, reject) => {
        runPrompt(req(message)).then((res: AxiosResponse) => {
            let jsonReg = /{\s*"command"\s*:\s*"[^"]*"\s*(,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*)?}/g
            let response = res.data.choices[0].message.content
            console.log(response)
            let responseJSONString = jsonReg.exec(response);
            if (responseJSONString == null || responseJSONString.length === 0) {
                if (response == null || response.length === 0) {
                    reject(503);
                    console.log(res);
                }else {
                    return resolve({ command: "message.common", characteristic: { text: response } });
                }
            }
            let responseJSON;
            try {
                responseJSON = JSON.parse(responseJSONString![0]);
            } catch (e) {
                reject(500);
                console.log(e);
            }
            resolve(responseJSON);
        }).catch((e) => {
            reject(500);
            console.log(e);
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
    await message.reactions.resolve("✅")!.users.remove(config.Discord.Id)
    await message.react("❌");
    await message.reply(msg).then((msg) => setTimeout(() => msg.delete(), 2000));
}

const randomColor = (): HexColorString => {
    return `#${(Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0')).toString()}`;
}

const range = (start: number, end: number): Array<number> => {
    if (start === end) return [start];
    return [start, ...range(start + 1, end)];
}

let cpuUsages: number[] = [];
let memoryUsages: number[] = [];
const logUsage = () => {
    let total = Object.values(os.cpus()[0].times).reduce(
        (acc, tv) => acc + tv, 0
    );
    let usage = process.cpuUsage();
    let currentCPUUsage = (usage.user + usage.system);
    cpuUsages.push(Number((currentCPUUsage / total * 100).toFixed(3)));
    const {rss, heapTotal, heapUsed} = process.memoryUsage()
    memoryUsages.push(Number((rss / os.totalmem() * 100).toFixed(3)));
    if (cpuUsages.length > 1000)
        cpuUsages.shift();
    if (memoryUsages.length > 1000)
        memoryUsages.shift();
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



    if (message.content === "야 => 대화 초기화") {
        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
        return message.reply("완료했습니다!");
    }

    if (message.content.startsWith(config.Discord.Prefix)) {
        let bot_permission = message.guild!.members.cache.find((member) => member.user.id === config.Discord.Id)!.roles.highest.permissions;
        try {
            const userMsg = message.content.slice(config.Discord.Prefix.length).trim();
            console.log(message.author.id + " | " + message.author.username + "#" + message.author.discriminator + ": " + userMsg)
            await message.react("🌀");
            if (!conversation[message.author.id])
                conversation[message.author.id] = {messages: [], lastTime: Date.now()};
            conversation[message.author.id].lastTime = Date.now();
            conversation[message.author.id]["messages"].push({role: "user", content: userMsg});
            let res: types.command|undefined;
            try {
                res = await getIntent(conversation[message.author.id]["messages"]);
                await message.react("✅");
                await message.reactions.resolve("🌀")!.users.remove(config.Discord.Id)
                conversation[message.author.id]["messages"].push({role: "assistant", content: JSON.stringify(res)});
            } catch (e) {
                await message.react("✅");
                await message.reactions.resolve("🌀")!.users.remove(config.Discord.Id)
                if (e === 503)
                    return await gotError(message, errMsg.general(`\n${ansiCode("red")}그런데.. 이번에는 오류가 아니라 GPT가 대답을 못했네요...?${ansiCode("reset")})`))
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
                        })
                        let img = dom.querySelector("canvas").toDataURL().replace(/^data:image\/png;base64,/, "");
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
                                    await bulkDelete(message, messageList);
                                } else if (res.characteristic.hasOwnProperty("content")) {
                                    messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                    await bulkDelete(message, messageList);
                                } else if (res.characteristic.hasOwnProperty("role")) {
                                    messageList = messageList.filter((msg) => msg.member!.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                    await bulkDelete(message, messageList);
                                } else {
                                    await bulkDelete(message, Number(res.characteristic.count));
                                }
                            } else if (res.characteristic.hasOwnProperty("user")) {
                                messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                await bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("content")) {
                                messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                await bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("role")) {
                                messageList = messageList.filter((msg) => msg.member!.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                await bulkDelete(message, messageList);
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
                        if (!bot_permission.has(PermissionsBitField.Flags.ManageRoles))
                            return await gotError(message, errMsg.permission.bot(permissionTranslation.ManageRoles))
                        let role = message.guild!.roles.cache.find((role) => role.name === "Muted");
                        if (!role) {
                            try {
                                await message.guild!.roles.create({
                                    name: "Muted",
                                    color: "#000000",
                                    permissions: []
                                })
                                message.guild!.channels.cache.forEach(async channel => {
                                    const mutedRole = await channel.guild.roles.cache.find((role) => role.name === 'Muted');
                                    await (channel as TextChannel).permissionOverwrites.create(mutedRole as Role, {
                                        SendMessages: false
                                    });
                                });
                                role = await message.guild!.roles.cache.find((role) => role.name === "Muted");
                            } catch (e) {
                                return await gotError(message, errMsg.general("Muted 역할생성에 실패하였습니다"))
                            }
                        }
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)![0];
                            if (res.characteristic.isMute == "true") {
                                if (message.guild!.members.cache.get(uid!)!.roles.cache.find(role => role.name === "Muted"))
                                    return await gotError(message, "이미 뮤트된 유저입니다!");
                                await message.guild!.members.cache.get(uid)!.roles.add(role as Role);
                                await message.reply("완료했습니다!")
                            } else {
                                if (!message.guild!.members.cache.get(uid)!.roles.cache.find(role => role.name === "Muted"))
                                    return await gotError(message, "뮤트된 유저가 아닙니다!");
                                await message.guild!.members.cache.get(uid)!.roles.remove(role as Role);
                                await message.reply("완료했습니다!")
                            }
                        } catch (e) {
                            await gotError(message, errMsg.general("유저 역할을 수정하는 도중 오류가 발생하였습니다."))
                            console.log(e)
                        }
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
                }
            }
            await controller(res as types.command);
        } catch (e) {
            console.error(e)
        }
    }
}

// Logger
logUsage()
setInterval(logUsage, 1000)


// Web Server
app.server.listen(port, () => {
    console.log(`Express Https Server is running on port ${port}`);
});