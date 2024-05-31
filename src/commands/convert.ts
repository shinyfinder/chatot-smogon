import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';

/**
 * Unit converter
 * @param thisnumber Number to convert
 * @param to Output unit
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('convert')
        .setDescription('A simple unit converter. Input units are assumed from selected output')
        .addNumberOption(option =>
            option.setName('thisnumber')
            .setDescription('Value to convert')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('to')
            .setDescription('Units to convert to')
            .setRequired(true)
            .addChoices(
                { name: 'F', value: 'f' },
                { name: 'C', value: 'c' },
                { name: 'in', value: 'in' },
                { name: 'cm', value: 'cm' },
                { name: 'km', value: 'km' },
                { name: 'mi', value: 'mi' },
            ))
        .setDMPermission(false) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }
        
        // get the inputs
        const valIn = interaction.options.getNumber('thisnumber', true);
        const unitOut = interaction.options.getString('to', true);

        // convert
        let valOut = 0;
        let unitIn = '';

        // assume input is C
        if (unitOut === 'f') {
            valOut = 1.8 * valIn + 32;
            unitIn = 'c';
        }
        // assume input is F
        else if (unitOut === 'c') {
            valOut = (valIn - 32) / 1.8;
            unitIn = 'f';
        }
        // assume input is cm
        else if (unitOut === 'in') {
            valOut = valIn / 2.54;
            unitIn = 'cm';
        }
        // assume input is in
        else if (unitOut === 'cm') {
            valOut = valIn * 2.54;
            unitIn = 'in';
        }
        // assume input is mi
        else if (unitOut === 'km') {
            valOut = valIn * 1.609;
            unitIn = 'mi';
        }
        // assume input is km
        else {
            valOut = valIn / 1.609;
            unitIn = 'km';
        }

        // round the output to 2 decimal places
        valOut = twoDecRound(valOut);

        // post the result to discord
        if (unitOut === 'in' && valOut > 12) {
            // if the inches is greater than 12, also output in feet
            const ftConversion = Math.floor(valOut / 12);
            const inConversion = twoDecRound(valOut % 12);

            // send to discord
            await interaction.reply(`${valIn} ${unitIn} = ${valOut} ${unitOut} (${ftConversion} ft ${inConversion} in)`);
        }
        else {
            await interaction.reply(`${valIn} ${unitIn} = ${valOut} ${unitOut}`);
        }
        
    },
};

function twoDecRound(num: number) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}