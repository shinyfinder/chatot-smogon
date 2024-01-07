/**
 * Takes a text string obtained via a HTTP fetch and converts it into a JSON.
 * Useful when retrieving files from the PS github that export an object
 * @param txt Text of HTTP-fetched respoonse
 * @returns JSON
 */
export function res2JSON(txt: string) {
    // first remove the variable declaration (everything before the leading {)
    const noDef = txt.replace(/[\s\S]*export.* = {/, '{');

    // setup a regex to determine the keys
    const keyFinderRegEX = /({?)(?<!"|[\w-]+)([^"\s'{]*)(?<!"):(?!®)/mg;

    // escape any : contained within ""
    let convertedJSONString = noDef.replace(/(?<=".*):(?=.*")(?!.*},)/gm, ':®');

    // put "" around all keys
    convertedJSONString = convertedJSONString.replace(keyFinderRegEX, '$1"$2":');

    // remove the dummy var
    convertedJSONString = convertedJSONString.replace(/®/gm, '');

    // replace bounding '' with ""
    convertedJSONString = convertedJSONString.replace(/(?<=\[|[,:] )'|'(?=[,\]}])/gm, '"');

    // add ® after any },
    convertedJSONString = convertedJSONString.replace(/},/gm, '},®');

    // remove anything between function definition and ®
    convertedJSONString = convertedJSONString.replace(/^\s*\w*\([^®]*/gm, '');

    // remove all ®
    convertedJSONString = convertedJSONString.replace(/®/gm, '');

    // remove any lingering comments
    // are there any atp?
    convertedJSONString = convertedJSONString.replace(/\s*\/\/.*/gm, '');

    // remove any trailing commas
    convertedJSONString = convertedJSONString.replace(/,([\n\t]*[}\]])/gm, '$1');
    
    // remove the trailing ;
    convertedJSONString = convertedJSONString.replace(/;/gm, '');

    // it should be a valid json now
    // so parse it as such
    const json: unknown = JSON.parse(convertedJSONString);

    return json;
}