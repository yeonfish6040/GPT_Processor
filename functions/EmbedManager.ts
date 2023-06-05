import {ColorResolvable, EmbedAuthorOptions, EmbedBuilder, EmbedFooterOptions, Message} from "discord.js";

export default class EmbedManager extends EmbedBuilder{
    message: Message | null = null;
    title: string | null = null;
    description: string | null = null;
    fields: {name: string, value: string, inline?: boolean}[][] | null = null;

    setTitle(title: string) {
        this.title = title;
        super.setTitle(title);
        return this;
    }
    setDescription(description: string) {
        this.description = description;
        super.setDescription(description);
        return this;
    }

    addTitle(title: string|undefined) {
        this.title += "\n"+(title?title:"");
        super.setTitle(this.title);
        return this;
    }
    addDescription(description: string) {
        this.description += "\n"+(description?description:"");
        super.setDescription(this.description);
        return this;
    }

    addFields(...fields: {name: string, value: string, inline?: boolean}[]) {
        if (!this.fields) this.fields = [];
        this.fields.push(fields);
        super.addFields(fields);
        return this;
    }
    changeField(name: string, value: string, inline?: boolean, new_name?: string) {
        if (!this.fields) {
            return this;
        }
        this.fields.forEach((field, x) => {
            field.forEach((field, y) => {
                if (this.fields![x][y].name === name) {
                    this.fields![x][y].name = new_name?new_name:name;
                    this.fields![x][y].value = value;
                    this.fields![x][y].inline = !!inline;
                }
            });
        });
        this.fields.forEach((field, i) => {
            if (i === 0)
                super.setFields(field);
            else
                super.addFields(field);
        });
        return this;
    }

    setMessage(message: Message) {
        this.message = message;
        return this;
    }

    edit() {
        if (this.message)
            this.message.edit({ embeds: [this] });
        return this;
    }
}