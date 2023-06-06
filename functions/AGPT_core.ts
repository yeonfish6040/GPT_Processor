import * as fs from "fs";

import { parentPort, isMainThread } from "worker_threads";

import { OpenAIApi, Configuration } from "openai";

import {AGPT_conversations} from "../learnings/AGPT_prompt";
import * as types from "../map/types";
import * as constant from "../map/AGPT_constant";
import * as interfaces from "../map/interfaces";

import db from "./db";

import {AxiosError, AxiosResponse} from "axios";
import {MysqlError, PoolConnection} from "mysql";
import path from "path";
import {Message} from "discord.js";
import EmbedManager from "./EmbedManager";
import {parent} from "../map/AGPT_constant";

if (!isMainThread && parentPort) {
    parentPort.on("message", async (value) => {
        if (value.evt === constant.parent.tStart) {
            value = value as {evt: string, task: string, uid: string, socket: boolean, openai?: OpenAIApi}

            // Start driver checking =============================
            parentPort!.postMessage({ evt: constant.child.SDC });

            // Check driver is registered
            const conn: PoolConnection = await db();
            conn.query(format("SELECT * FROM `GPT_Processor_Drivers` where `uid` = '{0}'", value.uid), async (err: MysqlError|null, result: interfaces.driver[]) => {
                if (result.length !== 1) {
                    return parentPort!.postMessage({
                        evt: constant.child.error.DNF,
                    });
                }
                conn.release();
                parentPort!.postMessage({ evt: constant.child.CDR });
                if (!value.socket) {
                    return parentPort!.postMessage({
                        evt: constant.child.error.DNC,
                    });
                }else {

                    parentPort!.postMessage({ evt: constant.child.CDC });
                }


                // Start process file checking =============================
                parentPort!.postMessage({ evt: constant.child.CPF });
                if (value.NRPC) {
                    let conn = await db();
                    toMain(conn, value)
                }else {
                    parentPort!.postMessage({ evt: constant.child.error.RPE });
                }
            });
        }
    })
}

async function main(value: {evt: string, task: string, uid: string, openai?: OpenAIApi}): Promise<void> {
    if (parentPort) {
        parentPort.postMessage({ evt: constant.child.SPP });

        value.openai = value.openai as OpenAIApi;

        const conversations: types.conversations = AGPT_conversations;
        conversations.push({
            role: "user",
            content: "Task: " + value.task + "\n" +
                "Respond only with the output in the exact format specified in the system prompt, with no explanation or conversation."
        })

        const process =  path.join(__dirname, "/AGPT_processes/" + value.uid + ".json")
        runPrompt(conversations, value.openai)
            .then((res: AxiosResponse) => {
                conversations.push(res.data.choices[0].messages);
                fs.writeFileSync(process, JSON.stringify(conversations, null, 2));
                let text = res.data.choices[0].message.content;
                parentPort!.postMessage({ evt: constant.child.log, data: text });
                let content = JSON.parse(text);
                content.goals.forEach((goal: string, i: number) => {
                    parentPort!.postMessage({ evt: constant.child.WGG, goal: goal, index: i+1 })
                });
                parentPort!.postMessage({ evt: constant.child.SRP });
            }).catch((e: AxiosError) => {
                let error = e as AxiosError;
                parentPort!.postMessage({ evt: constant.child.error.OAE, code: error.code, error: error.message });
            }
        )
    }
}

const runPrompt = async (messages: types.conversations, openai: OpenAIApi): Promise<AxiosResponse> => {
    return new Promise((resolve, reject) => {
        openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 1,
        }).then((res: AxiosResponse) => {
            resolve(res);
        }).catch((err: AxiosError) => {
            reject(err.toJSON());
        });
    })
}

const toMain = (conn: PoolConnection, value: {evt: string, task: string, uid: string, openai?: OpenAIApi}) => {
    conn.query(format("SELECT * FROM `GPT_Processor_Drivers` where `uid` = '{0}'", value.uid), (err: MysqlError|null, result: interfaces.driver[]) => {
        let configuration = new Configuration({
            apiKey: result[0].openai_token,
        });
        let openai = new OpenAIApi(configuration);
        conn.release();
        value.openai = openai;
        return main(value)
    });
}

const format = function (formatted: string, ...args: string[]): string {
    for(let arg in args) {
        formatted = formatted.replace("{" + arg + "}", args[arg]);
    }
    return formatted;
};