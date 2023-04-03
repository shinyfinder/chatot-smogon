/**
 * Creates a 32-bit hash of a string.
 * Hashing algorithm is based on hashCode() in Java
 * @param {string} str  String to be hashed
 */
export function computeHash(str: string) {
    // JS implementation of Java str hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        // convert to 32bit int
        hash |= 0;
    }

    return hash;
}