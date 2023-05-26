module.exports = (need, list) => {
    return [
        { role: "system", content: "Response as json string only." },
        { role: "system", content: "You need "+need },
        { role: "system", content: "Google search result is "+list },

        { role: "user", content: "Give me the list of urls what you want to see" }
    ]
}