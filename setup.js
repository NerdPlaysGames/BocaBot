'use strict';

require('dotenv').config();
const fetch = require('node-fetch');

let url = `https://discord.com/api/v8/applications/${process.env.appid}/commands`;

let closureOptions = {
  // eslint-disable-next-line max-len
  body: '{"name":"closures","type":1,"description":"Sends closures listed on the Cameron County website","options":[{"name":"today","description":"All closures for today","type":1},{"name":"listed","description":"All closures listed","type":1}]}',
  headers: {
    Authorization: `Bot ${process.env.token}`,
    'Content-Type': 'application/json',
    // eslint-disable-next-line max-len
    cookie: '__dcfduid=b8ef54c12fa511eca37b42010a0a081e; __sdcfduid=b8ef54c12fa511eca37b42010a0a081efa7d6462f725acd527424f5149d86bad7ea91baabf16a2745648e3fc1e58d460;',
  },
  method: 'POST',
};

fetch(url, closureOptions)
  .then((res) => { res.json(); })
  .then((json) => { console.log(json); })
  .catch((err) => { console.error(`error: ${err}`); });

let setupOptions = {
  // eslint-disable-next-line max-len
  body: '{"name": "follow","type": 1,"description": "Follows a channel","options": [{"name": "daily-rc-updates","description": "Follows a channel that puts a message about the days closure every day at 5am Central","type": 1  },  {"name": "roadclosures","description": "Follows a channel that sends update every time there is an new/updated closure","type": 1},{"name": "text","description": "Follows a channel that sends update every time there is a text message from the Cameron County text message system","type": 1},{"name": "tfr","description": "Follows a channel that sends update every time there is an new/updated TFR","type": 1},{"name": "data","description": "Follows a channel that sends update every time data is changed on the website","type": 1}]}',
  headers: {
    Authorization: `Bot ${process.env.token}`,
    'Content-Type': 'application/json',
  },
  method: 'POST',
};

fetch(url, setupOptions)
  .then((res) => { res.json(); })
  .then((json) => { console.log(json); })
  .catch((err) => { console.error(`error: ${err}`); });

let currentTesting = {
  body: '{"name":"current","type":1,"description":"Displays the current status of testing"}',
  headers: {
    Authorization: `Bot ${process.env.token}`,
    'Content-Type': 'application/json',
  },
  method: 'POST',
};

fetch(url, currentTesting)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((err) => console.error(`error:${err}`));

let vehicleOptions = {
  body: '{"name":"vehicles","type":1,"description":"Displays the different vehicles in production"}',
  headers: {
    Authorization: `Bot ${process.env.token}`,
    'Content-Type': 'application/json',
  },
  method: 'POST',
};

fetch(url, vehicleOptions)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((err) => console.error(`error:${err}`));

let TestingOptions = {
  body: '{"name":"testing","type":1,"description":"Displays the next expected testing"}',
  headers: {
    Authorization: `Bot ${process.env.token}`,
    'Content-Type': 'application/json',
  },
  method: 'POST',
};

fetch(url, TestingOptions)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((err) => console.error(`error:${err}`));
