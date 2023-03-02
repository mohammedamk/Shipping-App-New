const express = require('express')

const app = express()

require('dotenv').config()

const cors = require('cors')

const client = require('redis').createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
})
const bluebird = require('bluebird')

app.use(
  '/',
  cors(),
  (req, _res, next) => {
    req.rawRedis = client
    bluebird.promisifyAll(client)
    req.redis = client
    next()
  },
  require('./routes')
)

if (process.env.PROD == 'true') {
  const https = require('https')

  const fs = require('fs')

  const options = {
    key: fs.readFileSync(''),
    cert: fs.readFileSync(''),
    ca: fs.readFileSync(''),
    requestCert: true,
    rejectUnauthorized: false,
  }

  https.createServer(options, app).listen(8084, () => {
    console.log('Server started on 8084 with HTTPS')
  })
} else {
  app.listen(8084, () => {
    console.log('Server started on 8084 with HTTP')
  })
}
