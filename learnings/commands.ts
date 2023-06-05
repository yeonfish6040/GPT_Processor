export const commands = {
    message: {
        common: {

        },
        delete: {
            characteristic: {
                user: "...",
                content: "...",
                role: "...",
                count: "..."
            }
        }
    },
    user: {
        kick: {
            characteristic: {
                user: "...",
                reason: "..."
            }
        },
        ban: {
            characteristic: {
                user: "...",
                unban: "..."
            }
        },
        mute: {
            characteristic: {
                user: "...",
                isMute: "..."
            }
        },
        check_permission: {
            characteristic: {
                user: "..."
            }
        },
        AGPT: {
            characteristic: {
                task: "..."
            }
        }
    }
}
