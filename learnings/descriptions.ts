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
        timeout: {
            user: "Mute specific user",
            time: "Time of mute specific user. If you want to remove timeout from specific user, just fill it with null",
        },
        check_permission: {
            user: "Check permission of specific user"
        }
    },
    // AGPT: {
    //     task: "Which user wants"
    // }
}
