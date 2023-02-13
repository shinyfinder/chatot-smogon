# Chatot
Supplemental Discord bot for Smogon, written in TypeScript.

# Installation
This code assumes you have v.16.9.0 or later installed of [NodeJs](https://nodejs.org/en/). Please install or update that first before proceeding.

1. Obtain a copy of the source code by downloading the [zip](./archive/refs/heads/main.zip) of the repository or, if you have git installed, via the command line in your desired destination folder:

`git clone https://github.com/shinyfinder/chatot.git`

If you download the zip, extract the file into your desired directory.

2. Open a command line and navigate to your installation directory. Install the dependencies via:

`npm install`

If you wish to contribute to development, please run the following instead:

`npm install --save-dev`

3. Make a copy of the file `.sample-env` and rename the copy to `.env`. Thie file contains the environment variables required for the bot to run. **Never give out the values in this file!** Please refer to the discord.js documentation for [setting up your bot application](https://discordjs.guide/preparations/setting-up-a-bot-application.html) and [adding the bot to your server(s)](https://discordjs.guide/preparations/adding-your-bot-to-servers.html) to obtain these values.

Additions to the environment variables will need to be reflected in [config.ts](.blob/main/src/config.ts). These values are accessed within the bot as `config.VARIABLE_NAME`.

# Using the bot
This bot uses slash commands (a subset of application commands). By default, the commands are registered to the guild (server) ID in your `.env` only. To register your commands, run the following line in the terminal:

`npm run deploy`

You will need to run this command before first launch and whenever you add/edit commands. If you wish to register your commands globally (for use in any server your bot is in, not just the one in your `.env`), modify the `deploy-commands.ts` file.

If you want to delete a command from the guild specified in your `.env` file, run the following:

`npm run delete`

Code variations for adding and deleting commands depending on your desired scope are provided within the `deploy-commands.ts` and `delete-commands.ts` files, respectively.

Once your commands have been registered, start the bot from the terminal with the following:

`npm start`

You should see that the bot is now online in Discord. To confirm it is responding to commands, post the following within Discord:

`/ping`

The bot should respond with "Pong!". Remember that you must first deploy the commands before they can be used.

# Further Reading
Please refer to the Discord documentation for further information on [adding](https://discordjs.guide/creating-your-bot/creating-commands.html), [using](https://discordjs.guide/interactions/slash-commands.html), and [deleting](https://discordjs.guide/creating-your-bot/deleting-commands.html) slash commands. For more in-depth information, see the devloper documentation on [application commands](https://discord.com/developers/docs/interactions/application-commands).

# License
This software is distributed under the [MIT license](./blob/main/LICENSE).