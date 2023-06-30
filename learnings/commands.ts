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
        timeout: {
            characteristic: {
                user: "...",
                time: "..."
            }
        },
        check_permission: {
            characteristic: {
                user: "..."
            }
        },
        // AGPT: {
        //     characteristic: {
        //         task: "..."
        //     }
        // }
    }
}
