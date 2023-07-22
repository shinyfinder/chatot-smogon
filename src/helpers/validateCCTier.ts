import { ccMetaObj } from './constants.js';
/**
 * Validates the user input against the list of possible choices for the tier field in /config cc.
 * Because autocomplete does not validate the entered text automatically, we need to check ourselves.
 * @param tier Entered text in the /config cc <tier> option
 * @returns Whether the entered text was one of the autocomplete options
 */
export function validateCCTier(tier: string) {
    // make sure what they entered is a valid entry
    const valid = ccMetaObj.some(pair => pair.value === tier.toLowerCase());
    return valid;
}