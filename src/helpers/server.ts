import * as net from 'node:net';

/**
 * Creates a new net.Server listening on fd 3
 * @returns server
 */

export function createNetServer() {
    return server = net.createServer().listen({ fd: 3 });
}

export let server: net.Server;
