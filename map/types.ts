import {Socket} from "socket.io";

export type conversation = { role: "system"|"user"|"assistant", content: string };
export type conversations = Array<conversation>;
export type userConversations = { [key: string]: { messages: conversations, lastTime: number } };

export type command = { command: string, characteristic: { [key: string]: string } };

export type translation = { [key: string]: string };

export type sockets = { [key: string]: Socket };

export type AGPT_RES = { title: string, description: string, goals: Array<string> };

export type resourceUsageLog = { time: number, cpu: number, memory: number, cpuMax: number, memoryMax: number, cpuPercentage: number, memoryPercentage: number };