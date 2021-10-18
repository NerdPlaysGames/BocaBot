/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
'use strict';
require('dotenv').config();
let path = require('path');
const Logger = require('danno-tools').Logger;
const { Client, Intents, MessageEmbed } = require('discord.js');
const cron = require('node-cron');
// eslint-disable-next-line no-shadow
const fetch = require('node-fetch');
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
  embed.addField('Type', data.type, true);
  embed.addField('Status', data.status, true);
  embed.addField('Date', data.date, true);
  embed.addField('Time', data.time, true);

  let startTime = data.time.split(' to ')[0].replace('.', '');
  let closureDateStart = new Date(`${data.date} ${startTime} GMT-0500`);

  let endTime = data.time.split(' to ')[1].replace('.', '');
  let closureDateEnd = new Date(`${data.date} ${endTime} GMT-0500`);

  if (endTime.toUpperCase().includes('12:00 AM')) {
    closureDateEnd.setDate(closureDateEnd.getDate() + 1);
  }

  embed.setDescription(`Starts: <t:${closureDateStart.getTime() / 1000}:R>\nEnds: <t:${closureDateEnd.getTime() / 1000}:R>`);
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

cron.schedule('0 6 * * *', closureUpdate);

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_WEBHOOKS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES] });

// Fires once when the bot is ready
client.on('ready', () => {
  logger.info('Discord bot ready');
  let guild = client.guilds.cache.get(process.env.guild);

  rcChannel = guild.channels.cache.get(process.env.roadClosuresChannel);
  notamChannel = guild.channels.cache.get(process.env.notams);
});

<<<<<<< HEAD
client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'closures' && interaction.options._subcommand === 'listed') {
    const response = await fetch('https://status.nerdpg.live/api/roadClosures');
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('All listed closures');

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        let closure = data[i];

        let startTime = closure.time.split(' to ')[0].replace('.', '');
        let closureDateStart = new Date(`${closure.date} ${startTime} GMT-0500`);

        let endTime = closure.time.split(' to ')[1].replace('.', '');
        let closureDateEnd = new Date(`${closure.date} ${endTime} GMT-0500`);

        if (endTime.toUpperCase().includes('12:00 AM')) {
          closureDateEnd.setDate(closureDateEnd.getDate() + 1);
        }

        embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.getTime() / 1000}:R>\nEnds: <t:${closureDateEnd.getTime() / 1000}:R>`);
      }
    } else {
      embed.setDescription('There are no closures listed :\'(');
    }
    interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'closures' && interaction.options._subcommand === 'today') {
    const response = await fetch('https://status.nerdpg.live/api/roadClosures/today');
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('Today\'s listed closures');

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        let closure = data[i];

        let startTime = closure.time.split(' to ')[0].replace('.', '');
        let closureDateStart = new Date(`${closure.date} ${startTime} GMT-0500`);

        let endTime = closure.time.split(' to ')[1].replace('.', '');
        let closureDateEnd = new Date(`${closure.date} ${endTime} GMT-0500`);

        if (endTime.toUpperCase().includes('12:00 AM')) {
          closureDateEnd.setDate(closureDateEnd.getDate() + 1);
        }

        embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.getTime() / 1000}:R>\nEnds: <t:${closureDateEnd.getTime() / 1000}:R>`);
      }
    } else {
      embed.setDescription('There are no closures today :\'(');
    }
    interaction.reply({ embeds: [embed] });
  }
});

=======
>>>>>>> 51f176c79e02d5c9d16d27676774a06dd4f8cc9f
async function closureUpdate() {
  const response = await fetch('https://status.nerdpg.live/api/roadClosures/today');
  const data = await response.json();

  let embed = new MessageEmbed();
  embed.setTitle('Today\'s listed closures');

  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      let closure = data[i];

      let startTime = closure.time.split(' to ')[0].replace('.', '');
      let closureDateStart = new Date(`${closure.date} ${startTime} GMT-0500`);

      let endTime = closure.time.split(' to ')[1].replace('.', '');
      let closureDateEnd = new Date(`${closure.date} ${endTime} GMT-0500`);

      if (endTime.toUpperCase().includes('12:00 AM')) {
        closureDateEnd.setDate(closureDateEnd.getDate() + 1);
      }

      embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.getTime() / 1000}:R>\nEnds: <t:${closureDateEnd.getTime() / 1000}:R>`);
    }
  } else {
    embed.setDescription('There are no closures today :\'(');
  }

  rcChannel.send({ embeds: [embed] });
}

// Logs into the bot user
client.login(process.env.token);

