export const descriptions = {
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
            reason: "Reason of kick specific user. If there is no reason, just fill it with 'no reason'"
        },
        ban: {
            user: "Ban specific user",
            unban: "Unban specific user. If flase, ban. If true, unban"
        },
        mute: {
            user: "Mute specific user",
            isMute: "Mute or unmute specific user. If false, unmute user, if true, mute user",
        },
        check_permission: {
            user: "Check permission of specific user"
        }
    }
}
