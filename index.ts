import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import type {Worker} from "worker_threads";

import * as types from "./map/types";

import OpenAI from 'openai';

import {ansify, ansiCode} from "./map/ansi";
import {common} from "./learnings/common";
import {commands} from "./learnings/commands";
import {descriptions} from "./learnings/descriptions";

const req = common(commands, descriptions);

import {translate as permissionTranslation} from "./map/translate";
import * as errMsg from "./map/error";
import config from "./config_GPT_Processor.json";

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

import EmbedManager from "./functions/EmbedManager";

const openai = new OpenAI({
  apiKey: config.OpenAI.API_KEY,
});

import {ChatCompletion} from "openai/resources";

let uptime: number;
client.on(Events.ClientReady, () => {
  uptime = Date.now();
  console.log("Bot started at " + new Date(uptime).toLocaleString() + " as " + client.user!.tag);
});

client.on(Events.MessageCreate, onMessage);

client.login(config.Discord.Token);

// functions
const runPrompt = async (messages: types.conversations): Promise<ChatCompletion> => {
  return new Promise((resolve, reject) => {
    openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 1,
    }).then((res: ChatCompletion) => {
      resolve(res);
    }).catch((err: any) => {
      reject(err.toJSON());
    });
  })
}

const getIntent = (msg: Message, message: types.conversations): Promise<Array<types.command>> => {
  return new Promise((resolve, reject) => {
    runPrompt(req(msg, message)).then((res) => {
      let jsonReg = /\[({\s*"command"\s*:\s*"[^"]*"\s*(,\s*"characteristic"\s*:\s*{\s*[^{}]*\s*}\s*)?}[ ]*[,]?[ ]*)+\]/g
      let response = res.choices[0].message.content || "";
      console.log(response)
      let responseJSONString = jsonReg.exec(response);
      if (responseJSONString == null || responseJSONString.length === 0) {
        if (response == null || response.length === 0) {
          reject(503);
          console.error("OpenAI_no-response", res);
        } else {
          return resolve([{command: "message.common", characteristic: {text: response}}]);
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

const bulkDelete = (message: Message, messageList: Collection<string, Message<boolean>> | Message<boolean>[] | number, log = true): Promise<number> => {
  return new Promise((resolve, reject) => {
    (message.channel as TextChannel).bulkDelete(messageList, true).then((messages) => {
      if (log)
        (message.channel as TextChannel).send(ansify(`${ansiCode("green")}메시지 ${messages.size}개를 삭제하였습니다.${ansiCode("reset")}`)).then((msg) => setTimeout(() => msg.delete(), 2000));
      resolve(messages.size);
    }).catch((err) => {
      if (log)
        (message.channel as TextChannel).send(errMsg.message_delete()).then((msg) => setTimeout(() => msg.delete(), 2000));
      reject(err);
    })
  });
}

const gotError = async (message: Message, msg: string) => {
  await (message.channel as TextChannel).send(msg).then((msg) => setTimeout(() => msg.delete(), 5000));
}

const randomColor = (): HexColorString => {
  return `#${(Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0')).toString()}`;
}

const range = (start: number, end: number): Array<number> => {
  let arr: Array<number> = [];
  for (let i: number = start; i <= end; i++)
    arr.push(i);
  return arr;
}

const format = function (formatted: string, ...args: string[]): string {
  for (let arg in args) {
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

  if (message.content.startsWith(config.Discord.Prefix + " ")) {
    let bot_permission = message.guild!.members.cache.find((member) => member.user.id === config.Discord.Id)!.roles.highest.permissions;
    try {
      const userMsg = message.content.slice(config.Discord.Prefix.length).trim();
      console.log(message.author.id + " | " + message.author.username + "#" + message.author.discriminator + ": " + userMsg)
      message.channel.sendTyping();
      if (!conversation[message.author.id])
        conversation[message.author.id] = {messages: [], lastTime: Date.now()};
      conversation[message.author.id].lastTime = Date.now();
      conversation[message.author.id]["messages"].push({role: "user", content: userMsg});
      let res: Array<types.command> | undefined;
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
              let messageList: Collection<string, Message<boolean>> | Message<boolean>[] = await message.channel.messages.fetch()
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
                  return (message.channel as TextChannel).send(ansify(`${ansiCode("green")}총 ${count}개의 메시지를 삭제했습니다.${ansiCode("reset")}`));
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
              (message.channel as TextChannel).send({content: `<@${message.author.id}>`, embeds: [embed]})
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
