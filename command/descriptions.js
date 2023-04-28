module.exports = {
    message: {
        common: {
            characteristic: {
                text: "Just reply with your response."
            }
        },
        delete: {
            user: "Delete messages which sent by specific user",
            content: "Delete messages which contains specific content",
            role: "Delete messages which sent by specific role",
            count: "Delete specific amount of messages"
        }
    },
    user: {
        kick: {
            user: "Kick specific user",
        },
        ban: {
            user: "Ban specific user",
        },
        mute: {
            user: "Mute specific user",
            isMute: "Mute or unmute specific user. If false, unmute user, if true, mute user",
        },
    }
}
