const ansify = (str) => {
    return "```ansi\n" + str + "\n```";
}

const ansiCode = (color) => {
    return {
        "red": "[00;31m",
        "green": "[00;32m",
        "yellow": "[00;33m",
        "blue": "[00;34m",
        "magenta": "[00;35m",
        "cyan": "[00;36m",
        "white": "[00;37m",
        "black": "[00;30m",
        "bright_red": "[01;31m",
        "bright_green": "[01;32m",
        "bright_yellow": "[01;33m",
        "bright_blue": "[01;34m",
        "bright_magenta": "[01;35m",
        "bright_cyan": "[01;36m",
        "bright_white": "[01;37m",
        "bright_black": "[01;30m",
        "reset": "[0m",

        "background_red": "[41m",
        "background_green": "[42m",
        "background_yellow": "[43m",
        "background_blue": "[44m",
        "background_magenta": "[45m",
        "background_cyan": "[46m",
        "background_white": "[47m",
        "background_black": "[40m",
        "background_bright_red": "[101m",
        "background_bright_green": "[102m",
        "background_bright_yellow": "[103m",
        "background_bright_blue": "[104m",
        "background_bright_magenta": "[105m",
        "background_bright_cyan": "[106m",
        "background_bright_white": "[107m",
        "background_bright_black": "[100m",
    }[color];

}

module.exports = {
    ansify: ansify,
    ansiCode: ansiCode
}