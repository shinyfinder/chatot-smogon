export function overwriteTier(selectedOption: string) {
    const selectedLower = selectedOption.toLowerCase();
    // afaik C&C and raters use the same team of people regardless of the regulation, so store those without it
    // instead, use a key like genXvgc
    if (selectedLower.includes('vgc') || selectedLower.includes('bss')) {
        const regexMatch = selectedOption.match(/.*(?:vgc|bss)/i);
        if (regexMatch) {
            return regexMatch[0];
        }
    }

    // if there's nothing to overwrite, just return the input recast to lower case
    return selectedOption;
}