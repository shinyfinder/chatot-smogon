# Chatot
Supplemental Discord bot for Smogon, written in TypeScript.

# Installation
This code assumes you have v.16.9.0 or later installed of [NodeJs](https://nodejs.org/en/). Please install or update that first before proceeding. The package manager of choice for this project is pnpm. It can be installed with npm (installed by default with node) with the following, or any of the other methods on their [website](https://pnpm.io/installation).

`npm install -g pnpm`

1. Obtain a copy of the source code by downloading the [zip](https://github.com/shinyfinder/chatot-smogon/archive/refs/heads/main.zip) of the repository or, if you have git installed, via the command line in your desired destination folder:

`git clone https://github.com/shinyfinder/chatot.git`

If you download the zip, extract the file into your desired directory.

2. Open a command line and navigate to your installation directory. Install the dependencies via:

`pnpm install`

3. Make a copy of the file `.sample-env` and rename the copy to `.env`. Thie file contains the environment variables required for the bot to run. **Never give out the values in this file!** Please refer to the discord.js documentation for [setting up your bot application](https://discordjs.guide/preparations/setting-up-a-bot-application.html) and [adding the bot to your server(s)](https://discordjs.guide/preparations/adding-your-bot-to-servers.html) to obtain these values.

Additions to the environment variables will need to be reflected in [config.ts](.blob/main/src/config.ts). These values are accessed within the bot as `config.VARIABLE_NAME`.

# Using the bot
This bot uses slash commands (a subset of application commands). Deployment of these commands is handled during startup of the bot witihn the `/src/helpers/updateState.ts` file. This script detects any changes in your command definitions and (re)deploys them as appropriate. The deployment scope is defined within the command definitions themselves with the following flags:

```
global: <boolean>
guilds: <string[]>
```
Setting the global flag to `true` will cause the command to be deployed globally (i.e. to every server the bot is in). Setting the global flag to `false` and providing a list of server IDs as strings within the guilds array will instead deploy the command as a guild command (i.e. only to that guild) to the listed servers. Note that if the bot is in dev mode (its client id is equal to a value specifed in `/src/helpers/hashCommands.ts`), the specified guild array will be overwritten with the dev guild id specifed in the `.env`. 

Start the bot from the terminal with the following:

```
pnpm build
pnpm start
```

You should see that the bot is now online in Discord. To confirm it is responding to commands, post the following within Discord:

`/ping`

The bot should respond with "Pong!".

# Further Reading
Please refer to the Discord documentation for further information on [adding](https://discordjs.guide/creating-your-bot/creating-commands.html), [using](https://discordjs.guide/interactions/slash-commands.html), and [deleting](https://discordjs.guide/creating-your-bot/deleting-commands.html) slash commands. For more in-depth information, see the devloper documentation on [application commands](https://discord.com/developers/docs/interactions/application-commands).

Please see the [wiki](https://github.com/shinyfinder/chatot-smogon/wiki) for detailed information regarding setup and usage of the bot.

# License
This software is distributed under the [MIT license](./blob/main/LICENSE).