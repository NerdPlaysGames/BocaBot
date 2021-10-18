'use strict';

require('dotenv').config();
const fetch = require('node-fetch');

let url = `https://discord.com/api/v8/applications/${process.env.appid}/commands`;

let options = {
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

fetch(url, options)
  .then((res) => { res.json(); })
  .then((json) => { console.log(json); })
  .catch((err) => { console.error(`error: ${err}`); });
