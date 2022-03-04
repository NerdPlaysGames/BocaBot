# BocaBot
This bot is a simple script that checks my personal service that broadcasts new closures and NOTAMS that happen at Starbase!
<br>
<br>
<br>
## Setup instructions - Shell
---
1. Download Repository
2. Install latest version of Node.JS
3. Install package dependancies
4. Intialize bot project on Discord
5. Copy `.template.env` file and rename to `.env`
6. Fill in information for the bots
8. Run `node bot.js`

## Setup instructions - Docker
---
1. Download Repository
2. Install Docker
3. Run `docker build .`
4. Intialize bot project on Discord
5. Copy `.template.env` file and rename to `.env`
6. Fill in information for the bots
7. Run `docker run --env-file .env bocabot`


## Setup instructions - Slash Commands
--
1. Download Repository
2. Install latest version of Node.JS
3. Run `npm install`
4. Copy `.template.env` file and rename to `.env`
5. Fill in the bot token and app id
6. Run `node setup.js`

This will create the slash commands for the bot. This may take up to an hour.
## Issues
If you encounter any issues or need help, checkout the repo Issues tab...