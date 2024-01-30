import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import config from '../config.js';

interface IModlogPG {
    target: string,
    date: Date,
    reason: string
}
/**
 * Populates the database of rater information
 * This is currently a dev-only command
 */
export const command: SlashCommand = {
    global: false,
    guilds: ['1040378543626002442'],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('popraters')
        .setDescription('Populates the database of rater information')
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        let rmtChannels: string[][] = [];
        if (config.MODE === 'dev') {
            rmtChannels = [['1060628096442708068', 'gen9ou']];
        }
        else {
            rmtChannels = [
                // pu
                ['1061136198208344084', 'gen9pu'],
                // nu
                ['1061136091056439386', 'gen9nu'],
                // ru
                ['1061135917160607766', 'gen9ru'],
                // lc
                ['1061135027599048746', 'gen9lc'],
                // bss
                ['1060690402711183370', 'gen9bssregf'],
                // other
                /*
                ['1060682530094862477', ''],
                // ag
                ['1060682013453078711', ''],
                // old gen ou
                ['1060339824537641152', ''],
                // natdex non ou
                '1060037469472555028',
                // uber
                '1059901370477576272',
                // uu
                '1059743348728004678',
                // nat dex ou'
                '1059714627384115290',
                // cap
                '1059708679814918154',
                // vgc
                '1059704283072831499',
                // 1v1
                '1089349311080439882',
                // mono
                '1059658237097545758',
                // om
                '1059657287293222912',
                // dou
                '1059655497587888158',
                // ou
                '1059653209678950460',
                // rmt1 -- legacy system
                '630478290729041920',
                // rmt2 -- legacy system
                '635257209416187925',
                */
            ];
        }

    },

};