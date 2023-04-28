const Discord = require("discord.js");
const [ GatewayIntentBits, Events, PermissionsBitField ]= [ Discord.GatewayIntentBits, Discord.Events, Discord.PermissionsBitField ];
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
        runPrompt(req(message)).then((res) => {
            let jsonReg = /{\s*"command"\s*:\s*"[^"]*"\s*,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*}/g
            let response = res.data.choices[0].message.content
            response = jsonReg.exec(response)
            if (response.length == 0) {
                resolve(null);
            }
            try {
                response = JSON.parse(response);

            }catch (e) {
                resolve(null);
            }
            resolve(response);
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
async function onMessage(message) {
    if (message.author.bot) return;
    if (message.channel.type === "dm") return;

    if (message.content.startsWith(config.Discord.Bot.Prefix)) {
        const userMsg = message.content.slice(config.Discord.Bot.Prefix.length).trim();
        let res = await getIntent(userMsg);
        console.log(res)
        switch (res.command) {
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
                        messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                        bulkDelete(message, messageList);
                    }else if (res.characteristic.hasOwnProperty("content")) {
                        messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                        bulkDelete(message, messageList);
                    }else if (res.characteristic.hasOwnProperty("role")) {
                        messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                        bulkDelete(message, messageList);
                    }else {
                        bulkDelete(message, res.characteristic.count);
                    }
                }else if (res.characteristic.hasOwnProperty("user")) {
                    messageList = messageList.filter((msg) => msg.author.id === res.characteristic.user.replace("<@", "").replace(">", ""));
                    bulkDelete(message, messageList);
                }else if (res.characteristic.hasOwnProperty("content")) {
                    messageList = messageList.filter((msg) => msg.content.includes(res.characteristic.content));
                    bulkDelete(message, messageList);
                }else if (res.characteristic.hasOwnProperty("role")) {
                    messageList = messageList.filter((msg) => msg.member.roles.cache.has(res.characteristic.role.replace("<@&", "").replace(">", "")));
                    bulkDelete(message, messageList);
                }
                break;
        }
    }
}