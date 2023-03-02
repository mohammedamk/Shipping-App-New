const Twilio = require('twilio')
const { ErrLog } = require('../models')

async function sendSMS(phone, message) {
  try {
    const client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
      body: message,
    })
    return true
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
  }
}

async function sendVerification(token, phone) {
  try {
    let message = `Your token on kaizenShipping: ${token}`
    return await sendSMS(phone, message)
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
  }
}

async function sendPasswordChanged(email, firstName, lastName) {}

module.exports = {
  sendVerification,
  sendPasswordChanged,
}
