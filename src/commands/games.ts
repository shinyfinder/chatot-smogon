import { SlashCommandBuilder, ChatInputCommandInteraction, Collection, SlashCommandSubcommandBuilder, GuildBan, ChannelType, Message } from 'discord.js';
import { SlashCommand } from '../types/slash-command-base';
import { getRandInt } from '../helpers/getRandInt.js';
import { dexMondb, latestGen } from '../helpers/loadDex.js';
import { pool } from '../helpers/createPool.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { checkChanPerms } from '../helpers/checkChanPerms.js';

const currentlyPlaying = [];
interface IDATA {
    hp: number,
    atk: number,
    def: number,
    spa: number,
    spd: number,
    spe: number,
    weight: number,
    height: number,
    bst: number | undefined,
}
/**
 * Command to lookup information about a user or to find a particular ban in the ban list
 *
 */
export const command: SlashCommand = {
    global: true,
    guilds: [],
    // setup the slash command builder
    data: new SlashCommandBuilder()
        .setName('games')
        .setDescription('Let\'s play a game!')
        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('hilo')
            .setDescription('Guess if the answer is higher or lower'))
        .setDMPermission(false)
        .setDefaultMemberPermissions(0),

    // execute our desired task
    async execute(interaction: ChatInputCommandInteraction) {
        // make sure this command is used in a guild
        if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
            return;
        }

        if (interaction.options.getSubcommand() === 'hilo') {
            await interaction.deferReply();

            // check chan perms
            const canComplete = await checkChanPerms(interaction, interaction.channel, ['AddReactions']);
            if (!canComplete) {
                return;
            }

            // select a random pokemon from the current gen
            const currentMons = dexMondb.filter(mon => mon.isnonstandard === 'Standard' && mon.gen_id === latestGen);

            if (!currentMons.length) {
                await interaction.followUp('No mons found in the current gen. Something is wrong');
                return;
            }
            const idx = getRandInt(0, currentMons.length - 1);
            const monNameAlias = { name: currentMons[idx].name, alias: currentMons[idx].alias };

            // get a random question
            const questions = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe', 'Weight', 'Height', 'BST'];
            const qIndex = getRandInt(0, questions.length - 1);
            const q = questions[qIndex];

            // get the data for the pokemon
            const monData: IDATA[] | [] = (await pool.query('SELECT hp, atk, def, spa, spd, spe, weight, height FROM dex.pokemon WHERE alias=$1 AND gen_id=$2 AND isNonstandard=$3', [monNameAlias.alias, latestGen, 'Standard'])).rows;

            if (!monData.length) {
                await interaction.followUp('No mons found in the current gen. Something is wrong');
                return;
            }

            const firstRow = monData[0];
            // we need a binary option, so just pull off the timestamp
            // we could just create another array and get a rand index but that seems a bit excessive for 2 options
            // even = false = low
            // odd = true = high
            const hl = !!(Date.now() % 2);

            // also compute the BST
            const stats = [monData[0].hp, monData[0].atk, monData[0].def, monData[0].spa, monData[0].spd, monData[0].spe];
            const bst = stats.reduce((previous, current) => previous + current, 0);

            // get the correct answer
            let correctVal = 0;
            const qLower = q.toLowerCase() as keyof IDATA;
            if (qLower === 'bst') {
                correctVal = bst;
            }
            else {
                correctVal = firstRow[qLower];
            }

            // get the wrong answer
            const wrongVal = hl ? Math.floor(correctVal * 1.15) : Math.floor(correctVal / 1.15);
            const duration = 60 * 1000;
            const timeoutUNIX = Math.floor((Date.now() + duration) / 1000);

            const qText = `Is ${monNameAlias.name}'s ${q} higher or lower than ${wrongVal}? React to guess! The game ends <t:${timeoutUNIX}:R>`;

            // send the question
            const res = await interaction.followUp(qText);

            await res.react('⬆️');
            await res.react('⬇️');

            const answer = `The correct answer was **${hl ? 'Lower' : 'Higher'}** with an actual value of ${correctVal}! Thanks for playing.`;

            // create a timeout for the signups
            setTimeout(() => {
                void postAnswer(res, answer)
                    .catch(e => errorHandler(e));
            }, duration);
            

        }
    },
};


async function postAnswer(gamePost: Message, ans: string) {
    await gamePost.reply(ans);
}