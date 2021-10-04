/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
'use strict';
require('dotenv').config();
let path = require('path');
const Logger = require('danno-tools').Logger;
const { Client, Intents, MessageEmbed } = require('discord.js');
const logger = new Logger({ WTF: true, path: './logs' });
const ioClient = require('socket.io-client').io('wss://status.nerdpg.live');

let notamChannel, rcChannel;

// Socket IO stuff
ioClient.on('connect', () => {
  logger.info('Socket Connected');
});

// For every new closure
ioClient.on('newClosure', (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('New Closure!');
  embed.addField('Type', data.type);
  embed.addField('Status', data.status);
  embed.addField('Time', data.time);
  embed.addField('Date', data.date);

  rcChannel.send({ embeds: [embed] });
});

// Fires for every NOTAM
ioClient.on('newNOTAM', (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('New NOTAM!');
  embed.addField('Altitude', data.altitude);
  embed.addField('Date', data.date);

  notamChannel.send({ embeds: [embed] });
});

// Fires for every error on the Socket client
ioClient.on('connect_error', (err) => {
  logger.error(err);
});

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_WEBHOOKS] });

// Fires once when the bot is ready
client.once('ready', () => {
  logger.info('Discord bot ready');
  let guild = client.guilds.cache.get(process.env.spreaderGuild);

  rcChannel = guild.channels.cache.get(process.env.roadClosuresChannel);
  notamChannel = guild.channels.cache.get(process.env.notams);
});

// Logs into the bot user
client.login(process.env.token);
