import { AutocompleteFocusedOption, AutocompleteInteraction } from 'discord.js';
import { INVPair } from '../types/discord';

export async function filterAutocomplete(interaction: AutocompleteInteraction, focused: AutocompleteFocusedOption, opts: INVPair[]) {
    const enteredText = focused.value.toLowerCase();

    const filteredOut: INVPair[] = [];
    // filter the options shown to the user based on what they've typed in
    // everything is cast to lower case to handle differences in case
    // discord has a limit of 25 options shown
    for (const pair of opts) {
        if (filteredOut.length < 25) {
            if (pair.name.toLowerCase().includes(enteredText)) {
                filteredOut.push(pair);
            }
        }
        else {
            break;
        }
    }

    await interaction.respond(filteredOut);
}