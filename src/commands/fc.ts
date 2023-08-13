import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';

/**
 * Command to manage the friend code database.
 * Subcommands are add, remove, list
 */
export const command: SlashCommand = {
    global: false,
    guilds: [],
    data: new SlashCommandBuilder()
        .setName('fc')
        .setDescription('Manages the friend code database')
        .setDMPermission(false)
        /**
         * Add FC
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('add')
            .setDescription('Adds a friend code for the specified game/system')
            .addStringOption(option =>
                option.setName('game')
                .setDescription('The corresponding game or system')
                .addChoices(
                    { name: '3DS', value: '3ds' },
                    { name: 'HOME', value: 'home' },
                    { name: 'Switch', value: 'switch' },
                    { name: 'Pokemon Go', value: 'pogo' },
                )
                .setRequired(true))
            .addStringOption(option =>
                option.setName('code')
                .setDescription('Your friend code')
                .setRequired(true)))
        /**
         * Remove FC
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('remove')
            .setDescription('Removes all friend codes for the specified game/system, or the specific code if provided')
            .addStringOption(option =>
                option.setName('game')
                .setDescription('The corresponding game or system')
                .addChoices(
                    { name: '3DS', value: '3ds' },
                    { name: 'HOME', value: 'home' },
                    { name: 'Switch', value: 'switch' },
                    { name: 'Pokemon Go', value: 'pogo' },
                )
                .setRequired(true))
            .addStringOption(option =>
                option.setName('code')
                .setDescription('Your friend code')
                .setRequired(false)))
        /**
         * List FC
         */
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('list')
            .setDescription('Lists your friend code, or that of the specified user')
            .addStringOption(option =>
                option.setName('game')
                .setDescription('The corresponding game or system')
                .addChoices(
                    { name: '3DS', value: '3ds' },
                    { name: 'HOME', value: 'home' },
                    { name: 'Switch', value: 'switch' },
                    { name: 'Pokemon Go', value: 'pogo' },
                )
                .setRequired(true))
            .addUserOption(option =>
                option.setName('user')
                .setDescription('The user\'s code to list (can accept ids)')
                .setRequired(false))),
        
    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // add
        if (interaction.options.getSubcommand() === 'add') {
            await interaction.deferReply({ ephemeral: true });

            // get the user inputs
            const game = interaction.options.getString('game', true);
            const code = interaction.options.getString('code', true);

            // insert into db
            await pool.query('INSERT INTO chatot.fc (userid, game, code) VALUES ($1, $2, $3) ON CONFLICT (userid, game, code) DO NOTHING', [interaction.user.id, game, code]);

            // done
            await interaction.followUp('FC added');
        }

        // renove
        else if (interaction.options.getSubcommand() === 'remove') {
            await interaction.deferReply({ ephemeral: true });

            // get the user inputs
            const game = interaction.options.getString('game', true);
            const code = interaction.options.getString('code');

            // delete from db
            if (code) {
                await pool.query('DELETE FROM chatot.fc WHERE userid=$1 AND game=$2 AND code=$3', [interaction.user.id, game, code]);
            }
            else {
                await pool.query('DELETE FROM chatot.fc WHERE userid=$1 AND game=$2', [interaction.user.id, game]);
            }
            
            // done
            await interaction.followUp('FC removed');
        }

        // list
        else if (interaction.options.getSubcommand() === 'list') {
            await interaction.deferReply();

            // get the user inputs
            const game = interaction.options.getString('game', true);
            // if they didn't specify a user, default to the interaction user
            const user = interaction.options.getUser('user') ?? interaction.user;

            // retrieve from db
            const fcPG = await pool.query('SELECT code FROM chatot.fc WHERE userid=$1 AND game=$2', [user.id, game]);
            const fcs: { code: string }[] | [] = fcPG.rows;
            
            // extract the list of codes
            const fcArr = fcs.map(fc => fc.code);

            // done
            await interaction.followUp(`${user.displayName}'s ${game} FC(s):\n${fcArr.join('\n')}`);
        }
        
    },
};