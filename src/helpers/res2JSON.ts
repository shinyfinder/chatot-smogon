import { IPSLearnsets } from '../types/ps';

/**
 * Takes a text string obtained via a HTTP fetch and converts it into a JSON.
 * Useful when retrieving files from the PS github that export an object
 * @param txt Text of HTTP-fetched respoonse
 * @returns JSON
 */
export function res2JSON(txt: string) {
    // first remove the variable declaration (everything before the leading {)
    const noDef = txt.replace(/[^]*= /, '');

    // setup a regex to determine the keys
    // const keyFinderRegEX = /([{,]\s*)(\S+)\s*(:)/mg;
    const keyFinderRegEX = /({?)(\S*):/mg;

    // add double-quotes around the keys
    // then remove trailing commas (commas that are not followed by another key)
    // then replace any remaining single quotes with double quotes
    // then remove the last semicolon as part of the object definition
    const convertedJSONString = noDef.replace(keyFinderRegEX, '$1"$2":').replace(/,([\n\t]*[}\]])/g, '$1').replace(/'/g, '"').replace(';', '');

    // it should be a valid json now
    // so parse it as such
    const json = JSON.parse(convertedJSONString) as IPSLearnsets;

    return json;
}