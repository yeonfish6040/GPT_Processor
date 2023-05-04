const Discord = require("discord.js");
const { GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require("discord.js");
const client = new Discord.Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent] });

const { app, port } = require("./functions/WebServer");

const { Configuration, OpenAIApi } = require("openai");

const { ansify, ansiCode } = require("./map/ansi");

const errMsg = require("./map/error");

const req = require("./command/learnings")(require("./command/commands"), require("./command/descriptions"));
const permissionTranslation = require("./map/translate");

const config = require("./config.json");

const configuration = new Configuration({
    apiKey: config.OpenAI.API_KEY,
});
const openai = new OpenAIApi(configuration);

client.on(Events.ClientReady, () => {
    console.log("Bot is ready!");
});

client.on(Events.MessageCreate, onMessage);

client.login(config.Discord.Bot.Token);

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
                reject(null);
            }
            try {
                response = JSON.parse(response);

            }catch (e) {
                reject(null);
            }
            resolve(response);
        }).catch(() => {
            reject(null);
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
    message.reactions.resolve("✅").users.remove(config.Discord.Bot.Id)
    await message.react("❌");
    await message.reply(ansify(`${ansiCode("red")}${msg}${ansiCode("reset")}`)).then((msg) => setTimeout(() => msg.delete(), 2000));
}

const randomColor = () => {
    return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0');
}

const isNaN = (s) => {
    const regex = /^[0-9]+$/
    return regex.test(s);
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

    if (message.content.startsWith(config.Discord.Bot.Prefix)) {
        try {
            const userMsg = message.content.slice(config.Discord.Bot.Prefix.length).trim();
            console.log(message.author.id+" | "+message.author.username+"#"+message.author.discriminator+": "+userMsg)
            await message.react("🌀");
            let res = await getIntent(conversation[message.author.id]["messages"]);
            if (!res) return await gotError()
            if (!conversation[message.author.id])
                conversation[message.author.id] = { messages: [], lastTime: Date.now() };
            conversation[message.author.id].lastTime = Date.now();
            conversation[message.author.id]["messages"].push({ role: "user", content: userMsg });
            conversation[message.author.id]["messages"].push({ role: "assistant", content: JSON.stringify(res) });
            await message.react("✅");
            message.reactions.resolve("🌀").users.remove(config.Discord.Bot.Id)
            if (!res)
                return await gotError(errMsg.general())
            let controller = async (res) => {
                switch (res.command) {
                    case "system.reset":
                        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        message.reply("완료했습니다!")
                        break;
                    case "system.need.user":
                        let user = message.guild.members.cache.find((member) => member.name === res.content).id
                        await message.react("🌀");
                        message.reactions.resolve("✅").users.remove(config.Discord.Bot.Id)
                        if (!conversation[message.author.id])
                            conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        conversation[message.author.id].lastTime = Date.now();
                        conversation[message.author.id]["messages"].push({role: "user", content: user});
                        let res2 = await getIntent(conversation[message.author.id]["messages"]);
                        conversation[message.author.id]["messages"].push({role: "assistant", content: JSON.stringify(res)});
                        await message.react("✅");
                        message.reactions.resolve("🌀").users.remove(config.Discord.Bot.Id)
                        await controller(res2);
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
                    case "map.timer":
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


// Web Server
app.server.listen(port, () => {
    console.log(`Express Https Server is running on port ${port}`);
});