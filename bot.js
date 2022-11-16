/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
'use strict';
require('dotenv').config();
let path = require('path');
const Logger = require('danno-tools').Logger;
const { Client, Intents, MessageEmbed, NewsChannel } = require('discord.js');
const moment = require('moment');
require('moment-timezone')();
moment.tz.zone('America/Chicago').abbrs.push('CT');
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
let dataChannel, muChannel, notamChannel, rcChannel, textMessageChannel;

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
  textMessageChannel = await guild.channels.cache.get(process.env.textMessageChannel);
});

ioClient.on('textmessages', async (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('New Message from Cameron County');
  embed.setDescription(data);
  let txtmsg = await textMessageChannel.send({ embeds: [embed] });
  await txtmsg.crosspost();
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
  let { start: closureDateStart, end: closureDateEnd } = getClosureTimes(data);

  embed.setDescription(`Starts: <t:${closureDateStart.valueOf() / 1000}:R>\nEnds: <t:${closureDateEnd.valueOf() / 1000}:R>`);
  let RCMSG = await rcChannel.send({ embeds: [embed] });
  await RCMSG.crosspost();
});

// Fires for every NOTAM
ioClient.on('newNOTAM', async (data) => {
  let embed = new MessageEmbed();
  embed.setTitle('New TFR!');
  embed.addField('ID', `[${data.tfrID}](${data.link})`, true);
  embed.addField('Altitude', `${data.lowerAltitude}${data.units} - ${data.upperAltitude}${data.units}`, true);
  let URLID = data.tfrID.replace('/', '_');
  embed.setImage(`https://tfr.faa.gov/save_maps/sect_${URLID}.gif`);
  let start = new Date(`${data.dateStart} UTC`);
  let end = new Date(`${data.dateEnd} UTC`);
  // convert start & end to epoch
  let startEpoch = start.getTime() / 1000;
  let endEpoch = end.getTime() / 1000;
  embed.addField('Date', `Starts: <t:${startEpoch}:F>(<t:${startEpoch}:R>)\nEnds: <t:${endEpoch}:F>(<t:${endEpoch}:R>)`);

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

        let { start: closureDateStart, end: closureDateEnd } = getClosureTimes(closure);

        embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.valueOf() / 1000}:f>(<t:${closureDateStart.valueOf() / 1000}:R>)\nEnds: <t:${closureDateEnd.valueOf() / 1000}:f>(<t:${closureDateEnd.valueOf() / 1000}:R>)`);
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

        let { start: closureDateStart, end: closureDateEnd } = getClosureTimes(closure);

        embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.valueOf() / 1000}:R>\nEnds: <t:${closureDateEnd.valueOf() / 1000}:R>`);
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

  if (interaction.commandName === 'follow' && interaction.options._subcommand === 'text') {
    let channel = interaction.channel;
    let user = interaction.member;
    if (user.permissions.has('MANAGE_CHANNELS')) {
      textMessageChannel.addFollower(channel);
    }
    interaction.reply({ content: 'You will now receive updates on text messages from the Cameron County text message system.', ephemeral: true });
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
    const dataResponse = await fetch(`https://${process.env.host}/api/json/current`);
    const currentData = await dataResponse.json();

    let embed = new MessageEmbed();
    embed.setTitle('Current Testing Status');
    for (const i in currentData.testing) {
      const dataValue = currentData.testing[i];
      embed.addField(keys[i], dataValue);
    }

    interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'timing') {
    let embed = new MessageEmbed();
    embed.setTitle('Current Testing Status');
    embed.setDescription('Actual | Predicted');

    const timingResponse = await fetch(`https://${process.env.host}/api/json/timing`);
    const timingData = await timingResponse.json();

    // Sort timingData by position
    timingData.sort((a, b) => a.position - b.position);

    for (const i in timingData) {
      // Fields: name, actual, predicted, position, id
      const dataObj = timingData[i];
      embed.addField(dataObj.name, `${dataObj.actual} | ${dataObj.predicted}`);
    }

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

      let { start: closureDateStart, end: closureDateEnd } = getClosureTimes(closure);

      embed.addField(`${closure.type} - ${closure.status}`, `Starts:<t:${closureDateStart.valueOf() / 1000}:R>\nEnds: <t:${closureDateEnd.valueOf() / 1000}:R>`);
    }
  } else {
    embed.setDescription('There are no closures today :\'(');
  }

  let muMsg = await muChannel.send({ embeds: [embed] });
  await muMsg.crosspost();
}

function getClosureTimes(closure) {
  let startTime = closure.time.split(' to ')[0].replace('.', '');
  let date = moment(closure.date, 'dddd, MMMM DD, YYYY');
  let timezone = date.tz('America/Chicago').format('Z');
  let closureDateStart = (moment(startTime).isValid()) ? moment(`${startTime}${timezone}`) : moment(`${closure.date} ${startTime}${timezone}`, 'dddd, MMMM DD, YYYY h:mm aZ');

  let endTime = closure.time.split(' to ')[1].replace('.', '');
  let closureDateEnd = (moment(endTime).isValid()) ? moment(`${endTime}${timezone}`) : moment(`${closure.date} ${endTime}${timezone}`, 'dddd, MMMM DD, YYYY h:mm aZ');

  if (endTime.toUpperCase().includes('AM')) {
    closureDateEnd.setDate(closureDateEnd.getDate() + 1);
  }

  return {
    end: closureDateEnd,
    start: closureDateStart,
  };
}

// Logs into the bot user
client.login(process.env.token);
