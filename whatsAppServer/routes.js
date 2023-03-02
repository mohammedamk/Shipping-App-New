const router = require('express').Router()
require('dotenv').config()
const axios = require('axios').default
const multer = require('multer')
const express = require('express')

function isAuth(req, res, next) {
  if (
    req.get('UserData') == 'DSefZ2vnfW' &&
    req.get('UserPassData') == 'aaVWD7Pcqg'
  ) {
    next()
  } else {
    res.json({ status: 'failed', message: 'Wrong username/password' })
  }
}

async function sendMessage(body) {
  console.log(body)
  const url = `${process.env.API_URL}/${process.env.PRODUCT_ID}/${process.env.PHONE_ID}/sendMessage`
  return await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'x-maytapi-key': process.env.TOKEN,
    },
  })
}

async function parseMessage(redis, text, userID, name, conversation) {
  if (text == 'start') {
    await redis.delAsync(`user/${conversation}`)
  }
  if (!(await redis.existsAsync(`user/${conversation}`))) {
    if (userID) {
      await redis.setAsync(`user/${conversation}`, 'welcome-old', 'EX', 1800)
      return `
    Hello ${name} ! Welcome to ShipIndia's Whatsapp channel. What would you like to do today.

    Select the action by entering the number in the chat and send!
    
    Get my overseas address
    Track my parcel
    Pre-book my parcel
    Speak to our shipping specialist
    `
    } else {
      await redis.setAsync(`user/${conversation}`, 'welcome-new', 'EX', 1800)
      return `
      Hello! Welcome to ShipIndia's Whatsapp channel. We noticed that you have not registered with us as a customer. Would you like to? 

      Sign up as new ShipIndia customer
      Speak to our shipping specialist
      `
    }
  } else {
    switch (await redis.getAsync(`user/${conversation}`)) {
      case 'welcome-old':
        switch (text) {
          case '1':
            await redis.setAsync(
              `user/${conversation}`,
              'whCountry',
              'EX',
              1800
            )
            return `
            Select Country

            India
            Malaysia
            Singapore
            China
            Dubai

            To go back to the starting page, write "start"
            `
          case '2':
            if (userID) {
              const packages = await getPackagesByUserID(userID)
              if (!packages.error) {
                await redis.setAsync(
                  `user/${conversation}`,
                  'tracking',
                  'EX',
                  1800
                )
                return packages
              } else {
                return (
                  packages.message +
                  '\n\n To go back to the starting page, write "start"'
                )
              }
            } else {
              await redis.setAsync(
                `user/${conversation}`,
                'welcome-new',
                'EX',
                1800
              )
              return 'You need to be an existing client to track your parcels!'
            }
          case '3':
            return (
              `https://testproject.today/login` +
              '\n\n To go back to the starting page, write "start"'
            )
          case '4':
            await redis.delAsync(`user/${conversation}`)
            await redis.setAsync(`operator/${conversation}`, 'current')
            return `Hang on for a moment while one of our shipping specialist gets in touch with you via whatsapp. `
          default:
            return `Sorry, unfortunately that option is not available. Please choose either one of the following:
            
            Get my overseas address
            Track my parcel
            Pre-book my parcel
            Speak to our shipping specialist

            To go back to the starting page, write "start"
            `
        }
      case 'whCountry':
        if (
          ['India', 'Malaysia', 'Singapore', 'China', 'Dubai'].includes(text)
        ) {
          return await getAddressByCountry(text)
        } else {
          return `Unknown country!
          
          To go back to the starting page, write "start"`
        }
      case 'tracking':
        return (
          (await getPackageByTrackingUser(text, userID)) +
          '\n\n To go back to the starting page, write "start"'
        )
      case 'welcome-new':
        switch (text) {
          case '1':
            return `Here is a quick sign up form for you to fill and get your address! https://testproject.today/register
            
            To go back to the starting page, write "start"
            `
          case '2':
            await redis.delAsync(`user/${conversation}`)
            await redis.setAsync(`operator/${conversation}`, 'current')
            return `Hang on for a moment while one of our shipping specialist gets in touch with you via whatsapp. `
          default:
            return `Sorry, unfortunately that option is not available. Please choose either one of the following:
            
            Sign up as new ShipIndia customer
            Speak to our shipping specialist

            To go back to the starting page, write "start"
            `
        }
    }
  }
}

async function getPackageByTrackingUser(trackingNumber, userID) {
  const result = await axios
    .get(`${process.env.SHIPPING_API_URL}/packageByTracking`, {
      headers: {
        'X-API-KAIZEN': 'Y35B4LCWvJExmbfNEjeC',
      },
      params: {
        tracking: trackingNumber,
        userID,
      },
    })
    .then(response => response.data)
  if (result.status == 'success') {
    return `
    Tracking ID: ${result.message.trackingNumber}
    Weight: ${result.message.weight}
    Declared Value: ${result.message.declaredValue}
    Declared Type: ${result.message.declaredType}
    Delivery Mode: ${result.message.deliveryMode}
    Arrival Address: ${result.message.arrivalAddress}
    Warehouse Arrival: ${result.message.warehouseArrival}
    Status: ${result.message.status}
    `
  } else {
    return 'Server error!'
  }
}

async function getPackagesByUserID(userID) {
  const result = await axios
    .get(`${process.env.SHIPPING_API_URL}/getPackages`, {
      headers: {
        'X-API-KAIZEN': 'Y35B4LCWvJExmbfNEjeC',
      },
      params: {
        userID,
      },
    })
    .then(response => response.data)
  if (result.status == 'success') {
    return result.message.map(v => v.text).join('\n')
  } else {
    if (result.notfound) {
      return {
        error: true,
        message: `Sorry, unfortunately you don't have any active parcels`,
      }
    } else {
      return 'Server error!'
    }
  }
}

async function getAddressByCountry(country) {
  const result = await axios
    .get(`${process.env.SHIPPING_API_URL}/warehouses`, {
      headers: {
        'X-API-KAIZEN': 'Y35B4LCWvJExmbfNEjeC',
      },
      params: {
        country,
      },
    })
    .then(response => response.data)
  if (result.status == 'success') {
    return result.message
      .map(
        v => `
      Warehouse Name: ${v.name},
      Warehouse Address: ${v.address}
    `
      )
      .join('\n')
  } else {
    if (result.notfound) {
      return `Sorry, unfortunately we have no warehouses for this country as of right now`
    } else {
      return 'Server error!'
    }
  }
}

async function getUserByPhoneNumber(number) {
  const result = await axios
    .get(`${process.env.SHIPPING_API_URL}/getUser`, {
      headers: {
        'X-API-KAIZEN': 'Y35B4LCWvJExmbfNEjeC',
      },
      params: {
        phone: number,
      },
    })
    .then(response => response.data)
  if (result.status == 'success') {
    return result.message
  } else {
    return { error: result.message }
  }
}

router.get('/getCalls', isAuth, async (req, res) => {
  try {
    let calls = []
    const keys = await req.redis.keysAsync('*')
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].split('/')[0] == 'operator') {
        calls.push(keys[i].split('/')[1])
      }
    }
    res.json({ status: 'success', message: calls })
  } catch (err) {
    res.json({ status: 'failed', message: err.message })
  }
})

router.post('/endCall', isAuth, multer().none(), async (req, res) => {
  try {
    const { number } = req.body
    await req.redis.delAsync(`operator/${number}`)
    sendMessage({
      type: 'text',
      message: 'Operator ended the chat',
      to_number: number,
    })
    res.json({ status: 'success' })
  } catch (err) {
    res.json({ status: 'failed', message: err.message })
  }
})

router.post('/messageHandlerWebhook', express.json(), async (req, res) => {
  res.sendStatus(200)
  let { message, conversation } = req.body
  if (req.body.type != 'message') return
  let { type, text, fromMe } = message
  if (fromMe) return
  if (type === 'text') {
    if (await req.redis.getAsync(`operator/${conversation}`)) return
    const userType = await getUserByPhoneNumber(conversation)
    if (userType.error) {
      sendMessage({
        type: 'text',
        message: 'Server error',
        to_number: conversation,
      })
      return
    }
    sendMessage({
      type: 'text',
      skip_filter: true,
      message: await parseMessage(
        req.redis,
        text,
        userType.type == 'Existing' ? userType.userID : null,
        userType.name,
        conversation
      ),
      to_number: conversation,
    })
  }
})

module.exports = router
