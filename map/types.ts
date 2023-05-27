import {Socket} from "socket.io";

export type conversation = { role: "system"|"user"|"assistant", content: string };
export type conversations = Array<conversation>;
export type userConversations = { [key: string]: { messages: conversations, lastTime: number } };

export type command = { command: string, characteristic: { [key: string]: string } };

export type translation = { [key: string]: string };

export type sockets = { [key: string]: Socket };

export type keypair = { publicKey: string, privateKey: string };