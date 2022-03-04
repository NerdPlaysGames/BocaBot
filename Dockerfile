FROM node:lts-alpine3.13

WORKDIR /app

COPY package*.json /app

RUN npm install

COPY keys.json /app
COPY bot.js /app

CMD [ "node", "/app/bot.js" ]
