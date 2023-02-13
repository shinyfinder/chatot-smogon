/**
 * Causes the program to sleep for the specified number of milliseconds.
 * Function should be awaited.
 * @param ms Number of milliseconds to sleep
 * @returns Promise
 */
export async function sleep(ms: number) {
    await new Promise(r => setTimeout(r, ms));
}