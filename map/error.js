const { ansify, ansiCode } = require("./map/ansi");

module.exports = {
    general: () => { return ansify(`${ansiCode`red`}오류가 발생했습니다. 다시 시도해주세요.\n만약 오류가 계속된다면 대화를 초기화하는 방법도 있습니다! (명령어: '야 => 대화 초기화')${ansiCode`reset`}`) },
    message_delete: () => { return ansify(`${ansiCode`red`}메시지 삭제에 실패하였습니다.${ansiCode`reset`}`) },
    permission: {
        bot: (permission) => { return ansify(`${ansiCode`red`}에러! 권한이 부족합니다. 봇에게 충분한 권한이 부여되어있는지 확인하여 주세요.${ansiCode`reset`}\n권한 부족: ${permission}`) },
        user: (permission) => { return ansify(`${ansiCode`red`}에러! 권한이 부족합니다. 당신은 권한 ${ansiCode`reset`}\n${permission} ${ansiCode`red`}이(가) 부족합니다!${ansiCode`red`}`) }
    }
}