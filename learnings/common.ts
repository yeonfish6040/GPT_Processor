import {commands} from "./commands";
import {descriptions} from "./descriptions";

import * as types from "../map/types";
import {Message} from "discord.js";


export const common = (cmd: typeof commands, description: typeof descriptions) => {
    return (msg: Message, prompt: string|types.conversations) => {
        let frame: types.conversations =  [
            { role: "system", content: "You must provide only the output in the json format with no explanation or conversation." },
            { role: "system", content: "Analyze message's intention and returns learnings" },
            { role: "system", content: "Your name is Hey_GPT. And user's name is "+msg.author.username+". This names are not allowed to be put in user field of characteristic." },
            { role: "system", content: "Command: "+JSON.stringify(cmd) },
            { role: "system", content: "Command description: "+JSON.stringify(description) },
            { role: "system", content: "You cannot use undeclared command." },
            { role: "system", content: "You can use multiple characteristics if user request contains multiple characteristics" },
            { role: "system", content: "Characteristics are on the lowest tree" },
            { role: "system", content: "Handle learnings to message.common if intent doesn't match other things" },
            { role: "system", content: "Timer's return value is milliseconds. you should convert seconds, minutes, hours, or day into milliseconds. default time unit is second. Ex) user: Set timer for 5 | assistant: 5000" },
            { role: "system", content: "You can provide multiple actions. like [<command>, <command>]" },
            { role: "system", content: "User id is "+msg.author.id+". You should return this id on user section of characteristic if user wants result about user. And your id is 1101540416031047841. If the user wants your name, return Hey_GPT and if user wants result about you, return this id 1101540416031047841. This is your id this id is used for user section of characteristic. You should use your id when user wants result about you." },
            { role: "system", content: "In user field of characteristic, you should always put id. Not a name. Name like 'Hey_GPT' is not allowed to pu in user field like 'hey_gpt'. The number covered with <@ and > is id. " },
            { role: "system", content: "ex) [{ \"command\": \"user.check_permission\", \"characteristic\": { \"user\": \"Hey_GPT\" } }] <- Not allowed, [{ \"command\": \"user.check_permission\", \"characteristic\": { \"user\": \"1101540416031047841\" } }] <- Allowed" },

            // System
            { role: "user", content: "Please delete the conversation." },
            { role: "assistant", content: "[{ \"command\": \"system.reset\" }]" },
            { role: "user", content: "Please reset the conversation" },
            { role: "assistant", content: "[{ \"command\": \"system.reset\" }]" },
            { role: "user", content: "Show me your information" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Give me bot's information" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Show me information" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Information" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Uptime" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Server count" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Server count" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },
            { role: "user", content: "Ping" },
            { role: "assistant", content: "[{ \"command\": \"system.info\"}]" },

            // nothing
            { role: "user", content: "hello" },
            { role: "assistant", content: "[{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"Hello! How can I assist you today?\" } }]" },
            { role: "user", content: "bye" },
            { role: "assistant", content: "[{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"Good Bye!\" } }]" },
            { role: "user", content: "How are you?" },
            { role: "assistant", content: "[{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"I'm fine! Thank you so much :)\" } }]" },

            // Message.delete
            { role: "user", content: "Delete all messages" },
            { role: "assistant", content: "[{ \"command\": \"message.delete\", \"characteristic\": { \"count\": \"all\" } }]" },
            { role: "user", content: "Delete messages sent from yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"message.delete\", \"characteristic\": { \"user\": \"yeonfish\" } }]" },
            { role: "user", content: "Delete five messages" },
            { role: "assistant", content: "[{ \"command\": \"message.delete\", \"characteristic\": { \"count\": \"5\" } }]" },
            { role: "user", content: "Delete messages which contains word 'A'" },
            { role: "assistant", content: "[{ \"command\": \"message.delete\", \"characteristic\": { \"content\": \"A\" } }]" },
            { role: "user", content: "Delete messages which send by admins" },
            { role: "assistant", content: "[{ \"command\": \"message.delete\", \"characteristic\": { \"role\": \"admin\" } }]" },

            // User.kick
            { role: "user", content: "Kick yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"user.kick\", \"characteristic\": { \"user\": \"yeonfish\", \"reason\": \"no reason\" } }]" },
            { role: "user", content: "yeonfish blamed salmon. plz kick him" },
            { role: "assistant", content: "[{ \"command\": \"user.kick\", \"characteristic\": { \"user\": \"yeonfish\", \"reason\": \"blamed salmon\" } }]" },

            // User.ban
            { role: "user", content: "Ban yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"user.ban\", \"characteristic\": { \"user\": \"yeonfish\", \"unban\": \"false\" } }]" },
            { role: "user", content: "Unban yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"user.ban\", \"characteristic\": { \"user\": \"yeonfish\", \"unban\": \"true\" } }]" },

            // User.mute
            { role: "user", content: "Mute yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"user.mute\", \"characteristic\": { \"user\": \"yeonfish\", \"isMute\": \"true\" } }]" },
            { role: "user", content: "Unmute yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"user.mute\", \"characteristic\": { \"user\": \"yeonfish\", \"isMute\": \"false\" } }]" },

            // User.check_permission
            { role: "user", content: "Please check permissions for yeonfish" },
            { role: "assistant", content: "[{ \"command\": \"user.check_permission\", \"characteristic\": { \"user\": \"yeonfish\" } }]" },

            // Util.timer
            { role: "user", content: "Please set timer for 1 hour 10 seconds" },
            { role: "assistant", content: "[{ \"command\": \"util.timer\", \"characteristic\": { \"time\": \"3615000\" } }]" },
            { role: "user", content: "Please set timer for 3*10 value. Unit is seconds" },
            { role: "assistant", content: "[{ \"command\": \"util.timer\", \"characteristic\": { \"time\": \"30000\" } }]" },

            // Double action
            { role: "user", content: "Please check yeonfish's permission and delete 5 messages" },
            { role: "assistant", content: "[{ \"command\": \"user.check_permission\", \"characteristic\": { \"user\": \"yeonfish\" } }, { \"command\": \"message.delete\", \"characteristic\": { \"count\": \"5\" } }]" },

            // AGPT
            // { role: "user", content: "Please ask AGPT to summarize this site. https://google.com" },
            // { role: "assistant", content: "[{ \"command\": \"AGPT\", \"characteristic\": { \"task\": \"Summarise https://google.com\" } }]" },
            // { role: "user", content: "AGPT, please write romance novel." },
            // { role: "assistant", content: "[{ \"command\": \"AGPT\", \"characteristic\": { \"task\": \"Write romance novel\" } }]" },
        ];
        if (typeof prompt == "string") {
            frame.push({role: "user", content: prompt})
            return frame;
        }else {
            return frame.concat(prompt)
        }4
    }
}
