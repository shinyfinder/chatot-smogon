/**
 * Event class definition for hanlding events
 * All event handling instances conform to this form factor
 * A list of events can be found in the discord documentation: https://discord.js.org/#/docs/main/main/class/Client
 *
 * @param {string} name Event name.
 * @param {boolean} [once] Optional. Indicates whether the command should be run once and never again (i.e. on ready) or multiple times
 *
 * Execute takes a number of arguments, which varies based on which event is used.
 *
 * @returns Promise<void>
 */
export interface eventHandler {
    name: string;
    once?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(...args: any): Promise<void>;
}