FROM node:17.2-alpine3.12

RUN apk add --update curl py-pip make gcc g++

WORKDIR /app

COPY package.json /app

RUN npm install

COPY . /app

CMD ["node", "app.js"]