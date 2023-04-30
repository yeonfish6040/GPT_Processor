const Discord = require("discord.js");
const { GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require("discord.js");
const client = new Discord.Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent] });


const { Configuration, OpenAIApi } = require("openai");

const req = require("./command/learnings")(require("./command/commands"), require("./command/descriptions"));
const permissionTranslation = require("./util/translate");

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
            if (!response || response.length == 0) {
                resolve(null);
            }
            try {
                response = JSON.parse(response);

            }catch (e) {
                resolve(null);
            }
            resolve(response);
        }).catch((err) => {
            resolve(null);
        })
    });
}

const bulkDelete = (message, messageList, log=true) => {
    return new Promise((resolve, reject) => {
        message.channel.bulkDelete(messageList, true).then((messages) => {
            if (log)
                message.channel.send("```ansi\n[00;32m 메시지 " + messages.size + "개를 삭제하였습니다.[0m\n```").then((msg) => setTimeout(() => msg.delete(), 2000));
            resolve(messages.size);
        }).catch((err) => {
            console.log(err)
            if (log)
                message.channel.send("```ansi\n[00;31m 메시지 삭제에 실패하였습니다.[0m\n```").then((msg) => setTimeout(() => msg.delete(), 2000));
        })
    });
}

const gotError = async (message, msg) => {
    message.reactions.resolve("✅").users.remove(config.Discord.Bot.Id)
    await message.react("❌");
    await message.reply("```ansi\n[00;31m "+msg+"[0m\n```").then((msg) => setTimeout(() => msg.delete(), 2000));
}

const ansify = (str) => {
    return "```ansi\n" + str + "\n```";
}

const ansiCode = (color) => {
    return {
        "red": "[00;31m",
        "green": "[00;32m",
        "yellow": "[00;33m",
        "blue": "[00;34m",
        "magenta": "[00;35m",
        "cyan": "[00;36m",
        "white": "[00;37m",
        "black": "[00;30m",
        "bright_red": "[01;31m",
        "bright_green": "[01;32m",
        "bright_yellow": "[01;33m",
        "bright_blue": "[01;34m",
        "bright_magenta": "[01;35m",
        "bright_cyan": "[01;36m",
        "bright_white": "[01;37m",
        "bright_black": "[01;30m",
        "reset": "[0m",

        "background_red": "[41m",
        "background_green": "[42m",
        "background_yellow": "[43m",
        "background_blue": "[44m",
        "background_magenta": "[45m",
        "background_cyan": "[46m",
        "background_white": "[47m",
        "background_black": "[40m",
        "background_bright_red": "[101m",
        "background_bright_green": "[102m",
        "background_bright_yellow": "[103m",
        "background_bright_blue": "[104m",
        "background_bright_magenta": "[105m",
        "background_bright_cyan": "[106m",
        "background_bright_white": "[107m",
        "background_bright_black": "[100m",
    }[color];
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
            message.react("🌀");
            if (!conversation[message.author.id])
                conversation[message.author.id] = { messages: [], lastTime: Date.now() };
            conversation[message.author.id].lastTime = Date.now();
            conversation[message.author.id]["messages"].push({ role: "user", content: userMsg });
            let res = await getIntent(conversation[message.author.id]["messages"]);
            conversation[message.author.id]["messages"].push({ role: "assistant", content: JSON.stringify(res) });
            await message.react("✅");
            message.reactions.resolve("🌀").users.remove(config.Discord.Bot.Id)
            if (!res) {
                return gotError("오류가 발생했습니다. 다시 시도해주세요.\n만약 오류가 계속된다면 대화를 초기화하는 방법도 있습니다! (명령어: '야 => 대화 초기화')")
            }
            let controller = async (res) => {
                switch (res.command) {
                    case "system.reset":
                        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        message.reply("완료했습니다!")
                        break;
                    case "system.need.user":
                        let user = message.guild.members.cache.find((member) => member.name === res.content).id
                        message.react("🌀");
                        message.reactions.resolve("✅").users.remove(config.Discord.Bot.Id)
                        if (!conversation[message.author.id])
                            conversation[message.author.id] = {messages: [], lastTime: Date.now()};
                        conversation[message.author.id].lastTime = Date.now();
                        conversation[message.author.id]["messages"].push({role: "user", content: user});
                        let res2 = await getIntent(conversation[message.author.id]["messages"]);
                        conversation[message.author.id]["messages"].push({role: "assistant", content: JSON.stringify(res)});
                        await message.react("✅");
                        message.reactions.resolve("🌀").users.remove(config.Discord.Bot.Id)
                        controller(res2);
                        break;

                    case "message.common":
                        message.reply(res.characteristic.text);
                        break;
                    case "message.delete":
                        console.log(message.channel.permissionsFor(message.author))
                        // check if user has permission
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ManageMessages)) {
                            await gotError(message, "메시지를 삭제할 권한이 없습니다.")
                            break;
                        }
                        try {
                            let messageList = await message.channel.messages.fetch()
                            if (res.characteristic.hasOwnProperty("count")) {
                                if (res.characteristic.count == "all") {
                                    const deleteAll = async () => {
                                        let count = await bulkDelete(message, messageList, false);
                                        let delCount = count

                                        while (delCount != 0) {
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
                            await gotError(message, "메시지를 삭제하는 도중 오류가 발생했습니다.")
                        }
                        break;
                    case "user.check_permission":
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                            let member = message.guild.members.cache.find((member) => member.user.id == uid);
                            let role = member.roles.highest;
                            let rolePermissions = role.permissions.serialize();
                            let channel_permissions = message.channel.permissionsFor(uid).serialize();
                            let permission = `서버: ${message.guild.name}\n채널: <#${message.channel.id}>\n최고 권한: ${role.name}\n`;
                            permission += `서버 | 채널\n`;
                            Object.keys(channel_permissions).forEach((key) => {
                                permission += ` ${rolePermissions[key] ? "✅" : "❌"} \\|\\|\\| ${channel_permissions[key] ? "✅" : "❌"} - ${permissionTranslation[key]}\n`
                            });
                            let embed = new EmbedBuilder()
                                .setTitle(`${member.user.username}#${member.user.discriminator}님의 권한 목록`)
                                .setDescription(permission)
                                .setTimestamp();
                            message.reply({embeds: [embed]});
                        }catch (e) {
                            await gotError(message, "오류가 발생했습니다. 다시 시도해주세요.\n만약 오류가 계속된다면 대화를 초기화하는 방법도 있습니다! (명령어: '야 => 대화 초기화')")
                        }
                        break;
                    case "user.kick":
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.KickMembers)) {
                            gotError(message, "유저를 추방할 권한이 없습니다.")
                            break;
                        }
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                            let member = message.guild.members.cache.find((member) => member.user.id == uid);
                            await member.kick({ reason: res.characteristic.reason });
                            message.reply("완료했습니다!")
                        }catch (e) {
                            await gotError(message, "오류가 발생했습니다. 다시 시도해주세요.\n만약 오류가 계속된다면 대화를 초기화하는 방법도 있습니다! (명령어: '야 => 대화 초기화')")
                        }
                        break;
                    case "user.ban":
                        if (!message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.BanMembers)) {
                            await gotError(message, "유저를 차단할 권한이 없습니다.")
                            break;
                        }
                        try {
                            let uid = (/[0-9]+/).exec(res.characteristic.user)[0];
                            if (res.characteristic.unban == "false") {
                                let member = message.guild.members.cache.find((member) => member.user.id == uid);
                                await member.ban();
                            }else {
                                await message.guild.members.unban(client.users.cache.get(uid));
                            }
                            message.reply("완료했습니다!")
                        }catch (e) {
                            console.error(e)
                            await gotError(message, "오류가 발생했습니다. 다시 시도해주세요.\n만약 오류가 계속된다면 대화를 초기화하는 방법도 있습니다! (명령어: '야 => 대화 초기화')")
                        }
                    case "util.timer":
                        let time = res.characteristic.time;
                        break;
                }
            }
            await controller(res);
        }catch (e) {
            console.error(e )
        }
    }
}