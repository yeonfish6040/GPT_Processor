import * as types from "../map/types";

let setupPrompt: string = "Your task is to devise up to few highly effective goals to ensuring that the goals are optimally aligned with the successful completion of its assigned task.\n" +
    "The user will provide the task, you will provide only the output in the exact format specified below with no explanation or conversation.\n" +
    "Format: { title: string, description: string, goals: Array<string> }" +
    "Example input:\n" +
    "Write romance novel\n" +
    "Example output:\n" +
    "{" +
    "   \"title\": \"Task: Write a novel\"," +
    "   \"description\": \"Description: This bot will write a romance novel by achieving these goals.\"," +
    "   \"goals\": [" +
    "       \"Design characters with unique characteristics\"," +
    "       \"Make a romance story with reference to other novels\"," +
    "       \"Return story to user\"" +
    "   ]" +
    "}"+
    "Example output is just for show you the format. You should improve it as much as possible.\n"

let summerizeWebpagePrompt: string = "User will provide body part of webpage's  html code and what user want to know about webpage.\n" +
    "You should provide the output that summarizes the webpage fit with user's need.\n"



export let AGPT_conversations: types.conversations = [
    { role: "system", content: setupPrompt }
]

export let summarize_webpage_conversations: types.conversations = [
    { role: "system", content: summerizeWebpagePrompt }
]