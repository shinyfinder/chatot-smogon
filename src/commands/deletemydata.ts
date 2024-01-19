import { SlashCommandBuilder, ChatInputCommandInteraction, ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction, ComponentType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base.js';
import { pool } from '../helpers/createPool.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { resetVerificationRoles } from '../helpers/resetVerificationRoles.js';

/**
 * Command to test the bot is online and working.
 * @param data SlashCommandBuilder() instance from discord.js
 * @returns Replies Pong! in the chat
 *
 * Can be used as a template for future commands
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('deletemydata')
        .setDescription('Removes all instances of your data from the databases where possible'),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        const randInt = getRandInt(0, 65535);

        // build a button to give to the user to confirm their actions
        const confirm = new ButtonBuilder()
			.setCustomId(`deletedataconfirm${randInt}`)
			.setLabel('Delete my data')
			.setStyle(ButtonStyle.Danger);

		const cancel = new ButtonBuilder()
			.setCustomId(`deletedatacancel${randInt}`)
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(cancel, confirm);

        // get the user's confirmation
		const response = await interaction.reply({
			content: `This action will delete all instances of your data from the databases. Before confirming, please note:
* Any preferences and information you've previously provided will be lost.
* Deletion of your data may break some of Chatot's functionality for you.
* You will be rendered unverified in any servers that use a Smogon profile for verification. You may lose access to the server and your messages until you reverify.
* This will **not** lift any existing punishments on your account.
* This will **not** remove any logs of moderation actions taken against your account if logging is enabled in a server.
* Preferences, information, and verification can be provided again by running the appropriate commands.
Are you sure?
`,
			components: [row],
            ephemeral: true,
		});

        // setup a filter to make sure the person who responds is the person who initiated
        // this is probably unneeded since the confirmation msg is ephemeral, but better safe than sorry ig
        const collectorFilter = (btnInt: ButtonInteraction) => btnInt.user.id === interaction.user.id;

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, filter: collectorFilter, time: 2 * 60 * 1000 });
        collector.on('collect', async (i) => {
            try {
                await i.deferUpdate();
                if (i.customId === `deletedataconfirm${randInt}`) {
                    // we need a flag to check for errors because of the finally block
                    // while we could update the post at the end of the try, if that errors you might not release the client back into the pool
                    // and we can't put the update in the finally block because it would overwrite any updates done during errors
                    let hadError = false;
                    // query the pool with a transaction
                    const pgClient = await pool.connect();
                    try {
                        // start
                        await pgClient.query('BEGIN');
                        // delete
                        await pgClient.query('DELETE FROM chatot.raters WHERE userid=$1', [interaction.user.id]);
                        await pgClient.query('DELETE FROM chatot.identities WHERE discordid=$1', [interaction.user.id]);
                        await resetVerificationRoles(interaction.user.id, interaction.client);
                        await pgClient.query('DELETE FROM chatot.fc WHERE userid=$1', [interaction.user.id]);
                        await pgClient.query('DELETE FROM chatot.reminders WHERE userid=$1', [interaction.user.id]);
                        // end
                        await pgClient.query('COMMIT');
                    }
                    catch (e) {
                        await pgClient.query('ROLLBACK');
                        hadError = true;
                        errorHandler(e);
                        await i.editReply({ content: 'An error occurred and your data was not deleted', components: [] });
                    }
                    finally {
                        pgClient.release();
                    }

                    if (!hadError) {
                        await i.editReply({ content: 'Your data has been deleted.', components: [] });
                    }
                }
                else if (i.customId === `deletedatacancel${randInt}`) {
                    await i.editReply({ content: 'Action cancelled', components: [] });
                }
            }
            catch (e) {
                await interaction.editReply({ content: 'An error occurred and your data was not deleted', components: [] });
                errorHandler(e);
            }
            
        });
        collector.on('end', async (i) => {
            try {
                if (!i.size) {
                    await interaction.editReply({ content: 'Confirmation not received within the allotted time, action cancelled', components: [] });
                }
                
            }
            catch (e) {
                errorHandler(e);
            }
        });
        
    },
};