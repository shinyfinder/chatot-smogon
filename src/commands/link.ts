import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import crypto from 'crypto';
import { botConfig } from '../config.js';
/**
 * Command to test the bot is online and working.
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */
export const command: SlashCommand = {
    global: false,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Replies with Pong!') as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // generate a random iv
        const iv = crypto.randomBytes(16);

        // encrypt their user info to be sent to the server
        const userObj = {
            username: interaction.user.username,
            id: interaction.user.id,
        }

        const userJSON = JSON.stringify(userObj);
        const encryptedUser = encrypt(userJSON, iv);

        const url = new URL('http://localhost:5000/tools/link-account');
        url.search = new URLSearchParams({
            user: encryptedUser,
            iv: iv.toString('hex'),
        }).toString()

        await interaction.reply({ ephemeral: true, content: url.toString() });
    },
};

//Encrypting text
function encrypt(text: string, iv: Buffer) {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(botConfig.ENCRYPT_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
 }