const express = require('express')

const app = express()

require('dotenv').config()

const mongoose = require('mongoose')

const cors = require('cors')

const passport = require('passport')

const session = require('express-session')

const { fork } = require('child_process')

const tokenLogistics = require('./config/logisticsToken')

const client = require('redis').createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
})
const bluebird = require('bluebird')

require('./config/passport')(passport)
const RedisStore = require('connect-redis')(session)

const {Login, Admin, User, Logistics, WhatsApp, Landing} = require('./routes')

mongoose.connect(process.env.MONGO_CON_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
})

if (process.env.PROD == 'true') fork("adminCreation.js") //Creates the admin account if there's none

const corsOptions = {
    origin: [process.env.CORS_ORIGIN, process.env.CORS_LANDING_ORIGIN],
    credentials: true
}

app.use(express.urlencoded({ extended: true }))

app.use(session({
    store: new RedisStore({
        client
    }),
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}))

app.use(passport.initialize())

app.use(passport.session())

app.use('/login', cors(corsOptions), (req, res, next) => { bluebird.promisifyAll(client); req.redis = client; next() }, Login)
app.use('/admin', cors(corsOptions), (req, res, next) => { bluebird.promisifyAll(client); req.redis = client; next() }, Admin)
app.use('/user', cors(corsOptions), (req, res, next) => { bluebird.promisifyAll(client); req.redis = client; next() }, User)
app.use('/logistics', cors(), tokenLogistics, Logistics)
app.use('/whatsapp', cors(), WhatsApp)
app.use('/landing', cors(), Landing)

if (process.env.PROD == 'true') {
    const https = require('https')

    const fs = require('fs')

    const options = {
        key: fs.readFileSync('certificates/shipindia.co.key'),
        cert: fs.readFileSync('certificates/shipindia.co.crt'),
        ca: fs.readFileSync('certificates/shipindia.co.ca-bundle'),
        requestCert: true,
        rejectUnauthorized: false
    }

    https.createServer(options, app).listen(8081, () => { console.log("Server started on 8081 with HTTPS") });
}
else {
    app.listen(8081, () => { console.log("Server started on 8081 with HTTP") });
}
