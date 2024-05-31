import { SlashCommandBuilder, ChatInputCommandInteraction, ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction, ComponentType } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { pool } from '../helpers/createPool.js';
import { getRandInt } from '../helpers/getRandInt.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { resetVerificationRoles } from '../helpers/resetVerificationRoles.js';
/**
 * Removes the link between a user's discord account and their Smogon profile
 * This undoes whatever role manipulation was originally done during verification
 * 
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('unverify')
        .setDescription('Removes the link between your discord and forum accounts')
        .setDMPermission(false) as SlashCommandBuilder,

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return;
        }

        const randInt = getRandInt(0, 65535);

        // build a button to give to the user to confirm their actions
        const confirm = new ButtonBuilder()
			.setCustomId(`deleteverifyconfirm${randInt}`)
			.setLabel('Delete link')
			.setStyle(ButtonStyle.Danger);

		const cancel = new ButtonBuilder()
			.setCustomId(`deleteverifycancel${randInt}`)
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(cancel, confirm);

        // get the user's confirmation
		const response = await interaction.reply({
			content: `This action will delete the link between your Discord and Smogon forum profiles. Before confirming, please note:
* You will be rendered unverified in any server that uses verification. This may mean losing access to your old messages and usage of the server until you reverify.
* You may relink your profiles by running the verification command again.
* This will **not** lift any existing punishments on your account.
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
                if (i.customId === `deleteverifyconfirm${randInt}`) {
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
                        await pgClient.query('DELETE FROM chatot.identities WHERE discordid=$1', [interaction.user.id]);

                        // reset their verification role config
                        await resetVerificationRoles(interaction.user.id, interaction.client);

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
                else if (i.customId === `deleteverifycancel${randInt}`) {
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