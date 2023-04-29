module.exports = (cmd, description) => {
    return (prompt) => {
        let frame =  [
            { role: "system", content: "Response as json string only." },
            { role: "system", content: "Analyze message's intention and returns command" },
            { role: "system", content: "Command: "+JSON.stringify(cmd) },
            { role: "system", content: "Command description: "+JSON.stringify(description) },
            { role: "system", content: "You can use multiple characteristics if user request contains multiple characteristics" },
            { role: "system", content: "You cannot contain characteristics and command not in the command" },
            { role: "system", content: "characteristics are on the lowest of the tree of command" },
            { role: "system", content: "Do not send code." },
            { role: "system", content: "handle command to message.common if intent doesn't match other things" },

            // System
            { role: "user", content: "Please delete the conversation." },
            { role: "assistant", content: "{ \"command\": \"system.reset\" }" },
            { role: "user", content: "Please reset the conversation" },
            { role: "assistant", content: "{ \"command\": \"system.reset\" }" },
            { role: "user", content: "Yeonfish said \"Plz delete my messages\"" },
            { role: "assistant", content: "{ \"command\": \"system.need.user\", \"content\": \"yeonfish\" }" },
            { role: "user", content: "User_ID" },
            { role: "assistant", content: "{ \"command\": \"message.delete\", \"characteristic\": { \"user\": \"User_ID\" } }" },

            // nothing
            { role: "user", content: "hello" },
            { role: "assistant", content: "{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"Hello! How can I assist you today?\" } }" },
            { role: "user", content: "bye" },
            { role: "assistant", content: "{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"Good Bye!\" } }" },
            { role: "user", content: "How are you?" },
            { role: "assistant", content: "{ \"command\": \"message.common\", \"characteristic\": { \"text\": \"I'm fine! Thank you so much :)\" } }" },

            // Message.delete
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
            { role: "assistant", content: "{ \"command\": \"user.kick\", \"characteristic\": { \"user\": \"yeonfish\" } }" },

            // User.ban
            { role: "user", content: "Ban yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.ban\", \"characteristic\": { \"user\": \"yeonfish\" } }" },

            // User.mute
            { role: "user", content: "Mute yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.mute\", \"characteristic\": { \"user\": \"yeonfish\", \"isMute\": \"true\" } }" },
            { role: "user", content: "Unmute yeonfish" },
            { role: "assistant", content: "{ \"command\": \"user.mute\", \"characteristic\": { \"user\": \"yeonfish\", \"isMute\": \"false\" } }" },
        ];
        if (typeof prompt == "string") {
            frame.push({role: "user", content: prompt})
            return frame;
        }else {
            return frame.concat(prompt)
        }
    }
}
