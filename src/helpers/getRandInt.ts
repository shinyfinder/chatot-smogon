/**
 * Generates a random integer between the values provided (inclusive)
 * @param min Lower bound of int range
 * @param max Upper bound of int range
 * @returns Int
 */
export function getRandInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}