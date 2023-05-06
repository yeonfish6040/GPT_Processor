const fs = require("fs");
const path = require("path");
const os = require('os');

const { app, port } = require("./functions/WebServer");
const { ansify, ansiCode } = require("./map/ansi");
const req = require("./command/learnings")(require("./command/commands"), require("./command/descriptions"));
const permissionTranslation = require("./map/translate");
const errMsg = require("./map/error");
const config = require("./config_GPT_Processor.json");

const Discord = require("discord.js");
const { GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require("discord.js");
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ] ,
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: true
    }
});

const { Koreanbots } = require("koreanbots");
koreanbots = new Koreanbots({
    api: {
        token: config.KoreanBots.Token
    },
    clientID: config.Discord.Id
})
let update = servers => koreanbots.mybot.update({ servers, shards: client.shard?.count })
    .then(res => res.code === 304 ? null : console.log("Server count updated.", JSON.stringify(res)))
    .catch(console.error)

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: config.OpenAI.API_KEY,
});
const openai = new OpenAIApi(configuration);

const chartjs = require("chart.js");
const { JSDOM } = require("jsdom");

let uptime;
client.on(Events.ClientReady, () => {
    uptime = Date.now();
    console.log("Bot started at " + new Date(uptime).toLocaleString() + " as " + client.user.tag);

    update(client.guilds.cache.size);
    setInterval(update, 60000, client.guilds.cache.size);
});

client.on(Events.MessageCreate, onMessage);

client.login(config.Discord.Token);

// functions
const runPrompt = async (messages, ) => {
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
    })
}

const getIntent = (message) => {
    return new Promise((resolve, reject) => {
        runPrompt(req(message)).then((res) => {
            let jsonReg = /{\s*"command"\s*:\s*"[^"]*"\s*(,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*)?}/g
            let response = res.data.choices[0].message.content
            response = jsonReg.exec(response)[0]
            console.log(response)
            if (!response || response.length === 0) {
                reject(503);
            }
            try {
                response = JSON.parse(response);

            }catch (e) {
                reject(500);
            }
            resolve(response);
        }).catch(() => {
            reject(500);
        })
    });
}

const bulkDelete = (message, messageList, log=true) => {
    return new Promise((resolve, reject) => {
        message.channel.bulkDelete(messageList, true).then((messages) => {
            if (log)
                message.channel.send(ansify(`${ansiCode("green")}메시지 ${messages.size}개를 삭제하였습니다.${ansiCode("reset")}`)).then((msg) => setTimeout(() => msg.delete(), 2000));
            resolve(messages.size);
        }).catch((err) => {
            if (log)
                message.channel.send(errMsg.message_delete()).then((msg) => setTimeout(() => msg.delete(), 2000));
            reject(err);
        })
    });
}

const gotError = async (message, msg) => {
    message.reactions.resolve("✅").users.remove(config.Discord.Id)
    await message.react("❌");
    await message.reply(msg).then((msg) => setTimeout(() => msg.delete(), 2000));
}

const randomColor = () => {
    return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0');
}

const isNaN = (s) => {
    const regex = /^[0-9]+$/
    return regex.test(s);
}

const range = (start, end) => {
    if(start === end) return [start];
    return [start, ...range(start + 1, end)];
}

let cpuUsages = [];
let memoryUsages = [];
const logUsage = () => {
    let total = Object.values(os.cpus()[0].times).reduce(
        (acc, tv) => acc + tv, 0
    );
    let usage = process.cpuUsage();
    let currentCPUUsage = (usage.user + usage.system);
    cpuUsages.push((currentCPUUsage/total*100).toFixed(3));
    const { rss, heapTotal, heapUsed } = process.memoryUsage()
    memoryUsages.push((rss / os.totalmem() * 100).toFixed(3));
    if (cpuUsages.length > 500)
        cpuUsages.shift();
    if (memoryUsages.length > 500)
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
let conversation = {};
async function onMessage(message) {
    if (message.author.bot) return;
    if (message.channel.type === "dm") return;

    if (message.content === "야 => 대화 초기화") {
        conversation[message.author.id] = { messages: [], lastTime: Date.now() };
        return message.reply("완료했습니다!");
    }

    if (message.content.startsWith(config.Discord.Prefix)) {
        try {
            const userMsg = message.content.slice(config.Discord.Prefix.length).trim();
            console.log(message.author.id+" | "+message.author.username+"#"+message.author.discriminator+": "+userMsg)
            await message.react("🌀");
            if (!conversation[message.author.id])
                conversation[message.author.id] = { messages: [], lastTime: Date.now() };
            conversation[message.author.id].lastTime = Date.now();
            conversation[message.author.id]["messages"].push({ role: "user", content: userMsg });
            let res;
            try {
                res = await getIntent(conversation[message.author.id]["messages"]);
                await message.react("✅");
                message.reactions.resolve("🌀").users.remove(config.Discord.Id)
            }catch (e) {
                await message.react("✅");
                message.reactions.resolve("🌀").users.remove(config.Discord.Id)
                if (e === 503)
                    return await gotError(message, errMsg.general(`\n${ansiCode("red")}그런데.. 이번에는 오류가 아니라 GPT가 대답을 못했네요...?${ansiCode("reset")})`))
                else if (e === 500)
                    return await gotError(message, errMsg.general())
            }
            conversation[message.author.id]["messages"].push({ role: "assistant", content: JSON.stringify(res) });
            let controller = async (res) => {
                switch (res.command) {
                    case "system.reset":
                        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        message.reply("완료했습니다!")
                        break;
                    case "system.need.user":
                        let user = message.guild.members.cache.find((member) => member.name === res.content).id
                        await message.react("🌀");
                        message.reactions.resolve("✅").users.remove(config.Discord.Id)
                        if (!conversation[message.author.id])
                            conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        conversation[message.author.id].lastTime = Date.now();
                        conversation[message.author.id]["messages"].push({role: "user", content: user});
                        let res2 = await getIntent(conversation[message.author.id]["messages"]);
                        conversation[message.author.id]["messages"].push({role: "assistant", content: JSON.stringify(res)});
                        await message.react("✅");
                        message.reactions.resolve("🌀").users.remove(config.Discord.Id)
                        await controller(res2);
                        break;
                    case "system.info":
                        let now = Date.now();
                        let uptimeFixed = now - uptime;
                        let uptimeString = `${Math.floor(uptimeFixed / 1000 / 60 / 60)}시간 ${Math.floor(uptimeFixed / 1000 / 60) % 60}분 ${Math.floor(uptimeFixed / 1000) % 60}초`
                        let memoryUsage = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`

                        let canvas = new JSDOM("<canvas></canvas>");
                        dom = canvas.window.document;
                        let ctx = dom.querySelector("canvas").getContext("2d");
                        let data = {
                            labels: range(1, cpuUsages.length),
                            datasets: [
                                {
                                    label: "CPU",
                                    data: cpuUsages,
                                    borderColor: "blue",
                                    backgroundColor: "rgba(0, 0, 255, 0.2)",
                                    borderWidth: 1,
                                    fill: "origin"
                                },
                                {
                                    label: "Memory",
                                    data: memoryUsages,
                                    borderColor: "red",
                                    backgroundColor: "rgba(255, 0, 0, 0.2)",
                                    borderWidth: 1,
                                    fill: "origin"
                                }
                            ]
                        };
                        console.log(data.datasets[0].data, data.datasets[1].data)
                        let max;
                        if (cpuUsages[cpuUsages.length - 1] > 50 || memoryUsages[memoryUsages.length - 1] > 50)
                            max = 100;
                        else
                            max = cpuUsages[cpuUsages.length - 1] >= memoryUsages[memoryUsages.length - 1] ? Math.ceil(cpuUsages[cpuUsages.length - 1])+5 : Math.ceil(memoryUsages[memoryUsages.length - 1])+5;
                        let options = {
                            radius: 0,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'CPU, Memory Usage (%)'
                                }
                            },
                            scales: {
                                y: {
                                    min: 0,
                                    max: max,
                                    stepSize: 10
                                }
                            }
                        };
                        new chartjs(ctx, {
                            type: "line",
                            data: data,
                            options: options
                        })
                        let img = dom.querySelector("canvas").toDataURL().replace(/^data:image\/png;base64,/, "");
                        let filename = `chart_usage_${Date.now()}.png`;
                        fs.writeFileSync(path.join(__dirname, `functions/web/static/img/${filename}`), img, "base64");
                        let info = new EmbedBuilder()
                            .setTitle("봇 정보")
                            .addFields(
                                { name: "봇", value: client.user.tag, inline: true},
                                { name: "모듈", value: "OpenAI GPT 3.5 turbo", inline: true},
                                { name: "서버 수", value: client.guilds.cache.size.toString(), inline: true},
                            )
                            .addFields(
                                { name: "업타임", value: uptimeString, inline: true},
                                { name: "웹소켓 핑", value: client.ws.ping.toString() + "ms", inline: true},
                                { name: "메모리 사용량", value: memoryUsage, inline: true},
                            )
                            .setTimestamp()
                            .setColor(randomColor())
                            .setImage("https://lyj.kr:18001/img/" + filename)
                            .setFooter({ text: "봇 정보", iconURL: client.user.avatarURL()});
                        message.reply({ embeds: [info] })
                        break;

                    case "message.common":
                        message.reply(res.characteristic.text);
                        break;
                    case "message.delete":
                        console.log(message.channel.permissionsFor(message.author))
                        // check if user has permission
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) {
                            await gotError(message, errMsg.permission.user`${permissionTranslation.ManageMessages}`)
                            break;
                        }
                        try {
                            let messageList = await message.channel.messages.fetch()
                            if (res.characteristic.hasOwnProperty("count")) {
                                if (res.characteristic.count === "all") {
                                    const deleteAll = async () => {
                                        let count = await bulkDelete(message, messageList, false);
                                        let delCount = count

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
                                messageList = messageList.toJSON().slice(0, res.characteristic.count);
                                if (res.characteristic.hasOwnProperty("user")) {
                                    if (!isNaN(res.characteristic.user))
                                        messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                    else
                                        messageList = messageList.filter((msg) => msg.author.name === res.characteristic.user);
                                    await bulkDelete(message, messageList);
                                } else if (res.characteristic.hasOwnProperty("content")) {
                                    messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                    await bulkDelete(message, messageList);
                                } else if (res.characteristic.hasOwnProperty("role")) {
                                    messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                    await bulkDelete(message, messageList);
                                } else {
                                    await bulkDelete(message, res.characteristic.count);
                                }
                            } else if (res.characteristic.hasOwnProperty("user")) {
                                messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                await bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("content")) {
                                messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                await bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("role")) {
                                messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                await bulkDelete(message, messageList);
                            }
                        }catch (e) {
                            console.error(e)
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.check_permission":
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                            let member = message.guild.members.cache.find((member) => member.user.id === uid);
                            let role = member.roles.highest;
                            let rolePermissions = role.permissions.serialize();
                            let channel_permissions = message.channel.permissionsFor(uid).serialize();
                            let permission = `서버: ${message.guild.name}\n채널: <#${message.channel.id}>\n최고 권한: ${role.name}\n`;
                            permission += `서버 | 채널\n`;
                            permission += `${Object.entries(channel_permissions).map(([k, v]) => ` ${rolePermissions[k] ? "✅" : "❌"} \\|\\|\\| ${v ? "✅" : "❌"} - ${permissionTranslation[k]}`).join('\n')}`;
                            let embed = new EmbedBuilder()
                                .setTitle(`${member.user.username}#${member.user.discriminator}님의 권한 목록`)
                                .setDescription(permission)
                                .setTimestamp();
                            message.reply({embeds: [embed]});
                        }catch (e) {
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.kick":
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.KickMembers)) {
                            await gotError(message, errMsg.permission.user`${permissionTranslation.KickMembers}`)
                            break;
                        }
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                            let member = message.guild.members.cache.find((member) => member.user.id === uid);
                            await member.kick({ reason: res.characteristic.reason });
                            message.reply("완료했습니다!")
                        }catch (e) {
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.ban":
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.BanMembers)) {
                            await gotError(message, errMsg.permission.user`${permissionTranslation.BanMembers}`)
                            break;
                        }
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                            if (res.characteristic.unban === "false") {
                                let member = message.guild.members.cache.find((member) => member.user.id === uid);
                                await member.ban();
                            }else {
                                await message.guild.members.unban(client.users.cache.get(uid));
                            }
                            message.reply("완료했습니다!")
                        }catch (e) {
                            console.error(e)
                            await gotError(message, errMsg.general())
                        }
                        break;
                    case "user.mute":
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.MuteMembers))
                            return await gotError(message, errMsg.permission.user`${permissionTranslation.MuteMembers}`)
                        if (!message.guild.permissionsFor(client.user.id).has(PermissionsBitField.Flags.ManageRoles))
                            return await gotError(message, errMsg.permission.bot`${permissionTranslation.ManageRoles}`)
                        let role = message.guild.roles.cache.find((role) => role.name === "Muted");
                        if (!role) {
                            try {
                                await message.guild.roles.create({
                                    name: "Muted",
                                    color: "#000000",
                                    permissions: []
                                })
                                message.guild.channels.cache.forEach(async channel => {
                                    const mutedRole = await channel.guild.roles.cache.find((role) => role.name === 'Muted');
                                    await channel.permissionOverwrites.create(mutedRole, {
                                        SEND_MESSAGES: false
                                    });
                                });
                                role = await message.guild.roles.cache.find((role) => role.name === "Muted");
                            }catch (e) {
                                return await gotError(message, errMsg.general("Muted 역할생성에 실패하였습니다"))
                            }
                            try {
                                if (res.characteristic.isMute == true) {
                                    if (message.guild.members.cache.find(m => m.id === res.characteristic.user).roles.find(role => role.name === "Muted"))
                                        return await gotError(message, "이미 뮤트된 유저입니다!");
                                    await message.guild.members.cache.find(m => m.id === res.characteristic.user).roles.add(role);
                                    message.reply("완료했습니다!")
                                }else {
                                    if (!message.guild.members.cache.find(m => m.id === res.characteristic.user).roles.find(role => role.name === "Muted"))
                                        return await gotError(message, "뮤트된 유저가 아닙니다!");
                                    await message.guild.members.cache.find(m => m.id === res.characteristic.user).roles.remove(role);
                                    message.reply("완료했습니다!")
                                }
                            }catch (e) {
                                await gotError(message, errMsg.general("유저 역할을 수정하는 도중 오류가 발생하였습니다."))
                            }
                        }
                        break;
                    case "util.timer":
                        let time = res.characteristic.time;
                        if (isNaN(time))
                            return await gotError(message, "올바른 형식의 시간이 아닙니다!");
                        time = parseInt(time);

                        setTimeout(() => {
                            let embed = new EmbedBuilder()
                                .setTitle("타이머")
                                .setDescription(`타이머가 종료되었어요!\n${time/1000}초 만큼 지났어요!`)
                                .setColor(randomColor())
                                .setTimestamp();
                            message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] })
                        }, time)
                        let embedNotice = new EmbedBuilder()
                            .setTitle("타이머")
                            .setDescription(`타이머가 설정되었어요!\n${time/1000}초 후에 멘션해드릴게요!`)
                            .setColor(randomColor())
                            .setTimestamp();
                        await message.reply({embeds: [embedNotice]});
                        break;
                }
            }
            await controller(res);
        }catch (e) {
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