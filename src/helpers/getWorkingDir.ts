import { fileURLToPath } from 'url';

/**
 * Returns the directory name of the current module
 * @returns Working directory as string
 * 
 * Useful when creating paths to files
 */
export function getWorkingDir() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname =  fileURLToPath(new URL('..', import.meta.url)); //path.dirname(__filename);
    return __dirname;
}