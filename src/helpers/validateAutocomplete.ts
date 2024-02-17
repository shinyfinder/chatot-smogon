import { INVPair } from '../types/discord';

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