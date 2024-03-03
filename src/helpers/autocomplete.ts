import { AutocompleteFocusedOption, AutocompleteInteraction } from 'discord.js';
import { INVPair } from '../types/discord';
import { getGenAlias } from './ccQueries.js';


/**
 * Filters the array of possible values for the text the user entered to respond with autocomplete options
 * @param interaction Autocomplete interaction
 * @param focused The focused field
 * @param opts Array of name-value pairs returned as autocomplete options
 */

export async function filterAutocomplete(interaction: AutocompleteInteraction, focused: AutocompleteFocusedOption, opts: INVPair[]) {
    // cast what they enter to lower case for comparison
    const enteredText = focused.value.toLowerCase();
    
    const filteredPairs: INVPair[] = [];
    // filter the options shown to the user based on what they've typed in
    // everything is cast to lower case to handle differences in case
    // discord has a limit of 25 options shown
    for (const pair of opts) {
        if (filteredPairs.length < 25) {
            if (pair.name.toLowerCase().includes(enteredText)) {
                filteredPairs.push(pair);
            }
        }
        else {
            break;
        }
    }
    
    // if they entered something, sort the array by shortest to longest match
    // the shortest match that contains their substring is in theory the closest one to what they entered
    // not super robust, but hey it works.
    if (enteredText.length) {
        filteredPairs.sort((a, b) => a.name.length - b.name.length);
    }

    // respond
    await interaction.respond(filteredPairs);
    
}


/**
 * Validates the user input against the list of possible choices for the associated autocomplete
 * Because autocomplete does not validate the entered text automatically, we need to check ourselves.
 * @param input Entered text
 * @param choices Object containing the name, value pairs 
 * @returns Whether the entered text was one of the autocomplete options
 */
export function validateAutocomplete(input: string, choices: INVPair[]) {
    // make sure what they entered is a valid entry
    return choices.some(pair => pair.value === input);
}


const spaceRe = /[ _]+/g;
const removeRe = /[^a-z0-9-]/g;

/**
 * Converts a string into its Dex alias
 * @param s input string
 * @returns String converted to Dex alias snytax
 */
export function toAlias(s: string) {
    // dex alias conversion
    s = s.toLowerCase();
    s = s.replace(spaceRe, '-');
    s = s.replace(removeRe, '');
    return s;
}

/**
 * Converts a gen into its 2 letter abbreviation alias.
 * Similar to toAlias(), but with the added check of converting a number to the alias
 * Because autocomplete doesn't validate entered info, if users enter the text too quickly it can not map to the alias automatically
 * @param s Input string
 */
export async function toGenAlias(s: string) {
    // dex alias conversion
    s = s.toLowerCase();
    s = s.replace(spaceRe, '-');
    s = s.replace(removeRe, '');
    
    // if the entered string is only numbers, try to map it to the gen number
    if (/^\d+$/.test(s)) {
        const genAlias = await getGenAlias(s);

        // if you found a match, get the alias
        if (genAlias.length) {
            s = genAlias[0].alias;
        }
        // otherwise, just return with a blank string
        // this will be caught by our validator
        else {
            s = '';
        }
    }
    
    return s;
}


export function toPSAlias(s: string) {
    s = s.toLowerCase();
    s = s.replace(/[^a-z0-9]/g, '');
    return s;
}