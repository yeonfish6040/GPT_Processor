export const common = (cmd, description) => {
    return (prompt) => {
        let frame =  [
            { role: "system", content: "Response as json string only." },
            { role: "system", content: "Analyze message's intention and returns learnings" },
            { role: "system", content: "Command: "+JSON.stringify(cmd) },
            { role: "system", content: "Command description: "+JSON.stringify(description) },
            { role: "system", content: "You can use multiple characteristics if user request contains multiple characteristics" },
            { role: "system", content: "You cannot contain characteristics and learnings not in the learnings" },
            { role: "system", content: "characteristics are on the lowest of the tree of learnings" },
            { role: "system", content: "Do not send code." },
            { role: "system", content: "handle learnings to message.common if intent doesn't match other things" },
            { role: "system", content: "Timer's return value is milliseconds. you should convert seconds, minutes, hours, or day into milliseconds" },

            // System
            { role: "user", content: "Please delete the conversation." },
            { role: "assistant", content: "{ \"command\": \"system.reset\" }" },
            { role: "user", content: "Please reset the conversation" },
            { role: "assistant", content: "{ \"command\": \"system.reset\" }" },
            { role: "user", content: "Show me your information" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Give me bot's information" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Show me information" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Information" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Uptime" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Server count" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Server count" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },
            { role: "user", content: "Ping" },
            { role: "assistant", content: "{ \"command\": \"system.info\"}" },

            // nothing
            { role: "user", content: "hello" },
            { role: "assistant", content: "{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"Hello! How can I assist you today?\" } }" },
            { role: "user", content: "bye" },
            { role: "assistant", content: "{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"Good Bye!\" } }" },
            { role: "user", content: "How are you?" },
            { role: "assistant", content: "{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"I'm fine! Thank you so much :)\" } }" },

            // Message.delete
            { role: "user", content: "Delete all messages" },
            { role: "assistant", content: "{ \"command\": \"message.delete\", \"characteristic\": { \"count\": \"all\" } }" },
            { role: "user", content: "Delete messages sent from yeonfish" },
            { role: "assistant", content: "{ \"command\": \"message.delete\", \"characteristic\": { \"user\": \"yeonfish\" } }" },
            { role: "user", content: "Delete five messages" },
            { role: "assistant", content: "{ \"command\": \"message.delete\", \"characteristic\": { \"count\": \"5\" } }" },
            { role: "user", content: "Delete messages which contains word 'A'" },
            { role: "assistant", content: "{ \"command\": \"message.delete\", \"characteristic\": { \"content\": \"A\" } }" },
            { role: "user", content: "Delete messages which send by admins" },
            { role: "assistant", content: "{ \"command\": \"message.delete\", \"characteristic\": { \"role\": \"admin\" } }" },

            // User.kick
            { role: "user", content: "Kick yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.kick\", \"characteristic\": { \"user\": \"yeonfish\", \"reason\": \"no reason\" } }" },
            { role: "user", content: "yeonfish blamed salmon. plz kick him" },
            { role: "assistant", content: "{ \"command\": \"user.kick\", \"characteristic\": { \"user\": \"yeonfish\", \"reason\": \"blamed salmon\" } }" },

            // User.ban
            { role: "user", content: "Ban yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.ban\", \"characteristic\": { \"user\": \"yeonfish\", \"unban\": \"false\" } }" },
            { role: "user", content: "Unban yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.ban\", \"characteristic\": { \"user\": \"yeonfish\", \"unban\": \"true\" } }" },

            // User.mute
            { role: "user", content: "Mute yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.mute\", \"characteristic\": { \"user\": \"yeonfish\", \"isMute\": \"true\" } }" },
            { role: "user", content: "Unmute yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.mute\", \"characteristic\": { \"user\": \"yeonfish\", \"isMute\": \"false\" } }" },

            // User.check_permission
            { role: "user", content: "Please check permissions for yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.check_permission\", \"characteristic\": { \"user\": \"yeonfish\" } }" },

            // Util.timer
            { role: "user", content: "Please set timer for 1 hour 10 seconds" },
            { role: "assistant", content: "{ \"command\": \"util.timer\", \"characteristic\": { \"time\": \"3615000\" } }" },
            { role: "user", content: "Please set timer for 3*10 value. Unit is seconds" },
            { role: "assistant", content: "{ \"command\": \"util.timer\", \"characteristic\": { \"time\": \"30000\" } }" },
        ];
        if (typeof prompt == "string") {
            frame.push({role: "user", content: prompt})
            return frame;
        }else {
            return frame.concat(prompt)
        }
    }
}
