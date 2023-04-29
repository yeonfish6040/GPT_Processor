const Discord = require("discord.js");
const [ GatewayIntentBits, Events, PermissionsBitField, Util ]= [ Discord.GatewayIntentBits, Discord.Events, Discord.PermissionsBitField, Discord.Util ];
const client = new Discord.Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent] });


const { Configuration, OpenAIApi } = require("openai");

const req = require("./command/learnings")(require("./command/commands"), require("./command/descriptions"));

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
        console.log(JSON.stringify(req(message), null, 4))
        runPrompt(req(message)).then((res) => {
            let jsonReg = /{\s*"command"\s*:\s*"[^"]*"\s*(,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*)?}/g
            let response = res.data.choices[0].message.content
            console.log(response)
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

const bulkDelete = (message, messageList) => {
    message.channel.bulkDelete(messageList, true).then((messages) => {
        message.channel.send("```ansi\n[00;32m 메시지 " + messages.size + "개를 삭제하였습니다.[0m\n```").then((msg) => setTimeout(() => msg.delete(), 2000));
    }).catch((err) => {
        console.log(err)
        message.channel.send("```ansi\n[00;31m 메시지 삭제에 실패하였습니다.[0m\n```").then((msg) => setTimeout(() => msg.delete(), 2000));
    })
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
                message.reactions.resolve("✅").users.remove(config.Discord.Bot.Id)
                await message.react("❌");
                return message.reply("오류가 발생했습니다. 다시 시도해주세요.\n만약 오류가 계속된다면 대화를 초기화하는 방법도 있습니다! (명령어: '야 => 대화 초기화')");
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
                        // check if user has permission
                        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                            message.channel.send("```ansi\n[00;31m 메시지를 삭제할 권한이 없습니다.[0m\n```").then((msg) => setTimeout(() => msg.delete(), 2000));
                            break;
                        }
                        let messageList = await message.channel.messages.fetch()
                        if (res.characteristic.hasOwnProperty("count")) {
                            // slice collection
                            messageList = messageList.toJSON().slice(0, res.characteristic.count);
                            if (res.characteristic.hasOwnProperty("user")) {
                                if (!isNaN(res.characteristic.user))
                                    messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                                else
                                    messageList = messageList.filter((msg) => msg.author.name === res.characteristic.user);
                                bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("content")) {
                                messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                                bulkDelete(message, messageList);
                            } else if (res.characteristic.hasOwnProperty("role")) {
                                messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                                bulkDelete(message, messageList);
                            } else {
                                bulkDelete(message, res.characteristic.count);
                            }
                        } else if (res.characteristic.hasOwnProperty("user")) {
                            messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                            bulkDelete(message, messageList);
                        } else if (res.characteristic.hasOwnProperty("content")) {
                            messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                            bulkDelete(message, messageList);
                        } else if (res.characteristic.hasOwnProperty("role")) {
                            messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                            bulkDelete(message, messageList);
                        }
                        break;
                }
            }
            await controller(res);
        }catch (e) {
            console.error(e )
        }
    }
}