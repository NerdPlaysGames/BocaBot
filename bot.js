/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
'use strict';
require('dotenv').config();
let path = require('path');
const Logger = require('danno-tools').Logger;
const { Client, Intents, MessageEmbed, NewsChannel } = require('discord.js');
const cron = require('node-cron');
// eslint-disable-next-line no-shadow
const fetch = require('node-fetch');
const objectdiff = require('objectdiff');
const logger = new Logger({ WTF: true, path: './logs' });
const ioClient = require('socket.io-client').io(`wss://${process.env.host}`);

let keys = require('./keys.json');

/**
 * @type {NewsChannel}
 */
let dataChannel, muChannel, notamChannel, rcChannel;

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_WEBHOOKS] });

// Fires once when the bot is ready
client.on('ready', async () => {
  logger.info('Discord bot ready');
  let guild = await client.guilds.cache.get(process.env.guild);

  rcChannel = await guild.channels.cache.get(process.env.roadClosuresChannel);
  notamChannel = await guild.channels.cache.get(process.env.notams);
  dataChannel = await guild.channels.cache.get(process.env.datachannel);
  muChannel = await guild.channels.cache.get(process.env.morningUpdateChannel);
});

// Socket IO stuff
ioClient.on('connect', () => {
  logger.info('Socket Connected');
});

// For every new closure
ioClient.on('newClosure', async (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('New Closure!');
  embed.addField('Type', data.type, true);
  embed.addField('Status', data.status, true);
  embed.addField('Date', data.date, true);
  embed.addField('Time', data.time, true);

  let startTime = data.time.split(' to ')[0].replace('.', '');
  let closureDateStart = new Date(`${data.date} ${startTime} CST`);

  let endTime = data.time.split(' to ')[1].replace('.', '');
  let closureDateEnd = new Date(`${data.date} ${endTime} CST`);

  if (endTime.toUpperCase().includes('12:00 AM')) {
    closureDateEnd.setDate(closureDateEnd.getDate() + 1);
  }

  embed.setDescription(`Starts: <t:${closureDateStart.getTime() / 1000}:R>\nEnds: <t:${closureDateEnd.getTime() / 1000}:R>`);
  let RCMSG = await rcChannel.send({ embeds: [embed] });
  await RCMSG.crosspost();
});

// Fires for every NOTAM
ioClient.on('newNOTAM', async (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('New TFR!');
  embed.addField('Altitude', data.altitude);
  embed.addField('Date', data.date);

  let tfrMsg = await notamChannel.send({ embeds: [embed] });
  await tfrMsg.crosspost();
});

// Fires for every data update
ioClient.on('dataUpdatePub', async (data) => {
  let embed = new MessageEmbed();
  embed.setTitle(`Data change`);
  let testingDiff = objectdiff.diff(data.old.testing, data.new.testing);
  let changes = {};
  await diffValueHandler(testingDiff, null, changes);

  let timingDiff = objectdiff.diff(data.old.timing, data.new.timing);
  await timingDiffHandler(timingDiff, null, changes);

  // Delete Unnessary data
  delete changes.lastUpdated;
  // check if there is lastUpdatedBy in changes
  if (changes.lastUpdatedBy) {
    delete changes.lastUpdatedBy;
  }

  let changeString = [];

  for (const key in changes) {
    const difference = changes[key];
    changeString.push(`${keys[key]}: ${difference.removed} => ${difference.added}`);
  }

  embed.setDescription(changeString.join('\n'));

  let dataMSG = await dataChannel.send({ embeds: [embed] });
  await dataMSG.crosspost();
});

ioClient.on('updateClosure', async (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('Closure Updated!');
  embed.addField('Date', data.new.date, true);
  embed.addField('Time', data.new.time, true);
  let testingDiff = objectdiff.diff(data.old, data.new);
  let changes = {};
  await diffValueHandler(testingDiff, null, changes);

  let changeString = [];

  for (const key in changes) {
    const difference = changes[key];
    changeString.push(`${keys[key]}: ${difference.removed} => ${difference.added}`);
  }

  embed.setDescription(changeString.join('\n'));

  let rcMsg = await rcChannel.send({ embeds: [embed] });
  await rcMsg.crosspost();
});

// Handles nested differences in values
function diffValueHandler(diff, name, changes) {
  if (diff.changed === 'object change') {
    for (const key in diff.value) {
      diffValueHandler(diff.value[key], key, changes);
    }
  } else if (diff.changed === 'primitive change') {
    changes[name] = diff;
  }
}

function timingDiffHandler(diff, name, changes) {
  if (diff.changed === 'object change') {
    for (const eventKey in diff.value) {
      let event = diff.value[eventKey];
      for (const timeKey in event.value) {
        let time = event.value[timeKey];
        if (time.changed === 'primitive change') {
          // First letter of timeKey to uppercase
          let key = timeKey.charAt(0).toUpperCase() + timeKey.slice(1);
          let changeName = `${eventKey}${key}`;
          changes[changeName] = time;
        }
      }
    }
  } else if (diff.changed === 'primitive change') {
    changes[name] = diff;
  }
}

// Fires when a socket error occurs
ioClient.on('error', (err) => {
  logger.error(err);
});

cron.schedule('0 6 * * *', closureUpdate);

client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'closures' && interaction.options._subcommand === 'listed') {
    const response = await fetch(`https://${process.env.host}/api/json/roadClosures`);
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('All listed closures');

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        let closure = data[i];

        let startTime = closure.time.split(' to ')[0].replace('.', '');
        let closureDateStart = new Date(`${closure.date} ${startTime} CST`);

        let endTime = closure.time.split(' to ')[1].replace('.', '');
        let closureDateEnd = new Date(`${closure.date} ${endTime} CST`);

        if (endTime.toUpperCase().includes('12:00 AM')) {
          closureDateEnd.setDate(closureDateEnd.getDate() + 1);
        }

        embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.getTime() / 1000}:f>(<t:${closureDateStart.getTime() / 1000}:R>)\nEnds: <t:${closureDateEnd.getTime() / 1000}:f>(<t:${closureDateEnd.getTime() / 1000}:R>)`);
      }
    } else {
      embed.setDescription('There are no closures listed :\'(');
    }
    interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'closures' && interaction.options._subcommand === 'today') {
    const response = await fetch(`https://${process.env.host}/api/json/roadClosures/today`);
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('Today\'s listed closures');

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        let closure = data[i];

        let startTime = closure.time.split(' to ')[0].replace('.', '');
        let closureDateStart = new Date(`${closure.date} ${startTime} CST`);

        let endTime = closure.time.split(' to ')[1].replace('.', '');
        let closureDateEnd = new Date(`${closure.date} ${endTime} CST`);

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

  if (interaction.commandName === 'follow' && interaction.options._subcommand === 'data') {
    let channel = interaction.channel;
    let user = interaction.member;

    if (user.permissions.has('MANAGE_CHANNELS')) {
      dataChannel.addFollower(channel);
    }

    interaction.reply({ content: 'You will now receive updates on data updates.', ephemeral: true });
  }

  if (interaction.commandName === 'follow' && interaction.options._subcommand === 'roadclosures') {
    let channel = interaction.channel;
    let user = interaction.member;
    if (user.permissions.has('MANAGE_CHANNELS')) {
      rcChannel.addFollower(channel);
    }
    interaction.reply({ content: 'You will now receive updates on road closures.', ephemeral: true });
  }

  if (interaction.commandName === 'follow' && interaction.options._subcommand === 'tfr') {
    let channel = interaction.channel;
    let user = interaction.member;
    if (user.permissions.has('MANAGE_CHANNELS')) {
      notamChannel.addFollower(channel);
    }
    interaction.reply({ content: 'You will now receive updates on TFRs.', ephemeral: true });
  }

  if (interaction.commandName === 'follow' && interaction.options._subcommand === 'daily-rc-updates') {
    let channel = interaction.channel;
    let user = interaction.member;
    if (user.permissions.has('MANAGE_CHANNELS')) {
      muChannel.addFollower(channel);
    }
    interaction.reply({ content: 'You will now receive updates on daily road closure updates.', ephemeral: true });
  }

  if (interaction.commandName === 'vehicles') {
    const response = await fetch(`https://${process.env.host}/api/json/currentVehicles`);
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('All vehicles in production');

    data.sort((a, b) => a.position - b.position);

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        let vehicle = data[i];

        embed.addField(`${vehicle.name}`, `${vehicle.status}`);
      }
    } else {
      embed.setDescription('There are no vehicles listed :\'(');
    }

    interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'current') {
    const response = await fetch(`https://${process.env.host}/api/json/current`);
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('Current Testing Status');
    let testString = [];
    for (const i in data.testing) {
      const dataValue = data.testing[i];
      testString.push(`${keys[i]}: ${dataValue}`);
    }
    let timingString = [];
    for (const i in data.timing) {
      const dataObj = data.timing[i];
      timingString.push(`${keys[`${i}Predicted`]}: ${dataObj.predicted}`);
      timingString.push(`${keys[`${i}Actual`]}: ${dataObj.actual}`);
    }

    embed.addField('Testing', testString.join('\n'));
    embed.addField('Timing', timingString.join('\n'));

    interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'testing') {
    const response = await fetch(`https://${process.env.host}/api/json/expectedTest`);
    const data = await response.json();

    let embed = new MessageEmbed();
    embed.setTitle('Testing Expected');

    data.sort((a, b) => a.position - b.position);

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        let expectedTests = data[i];

        embed.addField(`${expectedTests.name}`, `${expectedTests.date}`);
      }
    } else {
      embed.setDescription('There are no expected tests listed :\'(');
    }

    interaction.reply({ embeds: [embed] });
  }
});

async function closureUpdate() {
  const response = await fetch(`https://${process.env.host}/api/json/roadClosures/today`);
  const data = await response.json();

  let embed = new MessageEmbed();
  embed.setTitle('Today\'s listed closures');

  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      let closure = data[i];

      let startTime = closure.time.split(' to ')[0].replace('.', '');
      let closureDateStart = new Date(`${closure.date} ${startTime} CST`);

      let endTime = closure.time.split(' to ')[1].replace('.', '');
      let closureDateEnd = new Date(`${closure.date} ${endTime} CST`);

      if (endTime.toUpperCase().includes('12:00 AM')) {
        closureDateEnd.setDate(closureDateEnd.getDate() + 1);
      }

      embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.getTime() / 1000}:R>\nEnds: <t:${closureDateEnd.getTime() / 1000}:R>`);
    }
  } else {
    embed.setDescription('There are no closures today :\'(');
  }

  let muMsg = await muChannel.send({ embeds: [embed] });
  await muMsg.crosspost();
}

// Logs into the bot user
client.login(process.env.token);
