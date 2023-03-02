const router = require('express').Router()
const multer = require('multer')
const { User, ErrLog } = require('../models')
const passport = require('passport')
const { sendVerification, sendPasswordChanged } = require('../helpers/sendSMS')
const { uuid } = require('uuidv4')
const {
  sendWelcomeEmailToUser,
  sendResetPassword,
} = require('../helpers/sendMail')

function isAuth(req, res, next) {
  if (req.user)
    res.json({
      status: 'failed',
      message: 'User already logged in',
      unauthorized: 1,
    })
  else next()
}

router.post(
  '/',
  isAuth,
  multer().none(),
  passport.authenticate('local'),
  async (req, res) => {
    try {
      if (req.user) res.json({ status: 'success', message: req.user })
      else
        res.json({
          status: 'failed',
          message: 'Wrong username or password, or the account is disabled',
        })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'login',
        endpoint: 'post-/',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/register', isAuth, multer().none(), async (req, res) => {
  try {
    const { email, firstName, lastName, password, phone, countryCode, pincode, identifier } = req.body
    //Check if identifier is in the redis, otherwise, return false
    if (identifier) {
      let verification = await req.redis.getAsync(identifier)
      if (verification) {
        if (pincode == JSON.parse(verification)?.token) {
          const user = await User.create({
            email,
            password,
            firstName,
            lastName,
            phone,
            countryCode,
            role: 1,
            avatar: 'avatar/default-avatar.png',
            notificationType: 'email',
          })

          await req.redis.delAsync(identifier)

          sendWelcomeEmailToUser(user, password)

          res.json({ status: 'success' })
        } else {
          res.json({ status: 'failed', message: 'Wrong pincode' })
        }
      } else {
        res.json({
          status: 'failed',
          message: 'Pincode expired, please send a new one',
        })
        return
      }
    } else {
      res.json({
        status: 'failed',
        message: 'Pincode expired, please send a new one',
      })
      return
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'login',
      endpoint: 'post-register',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/sendPhoneVerification',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { phone } = req.body
      const token = Math.floor(Math.random() * (1000 - 1 + 1)) + 1
      const identifier = uuid()
      await req.redis.setAsync(
        identifier,
        JSON.stringify({ phone, token }),
        'EX',
        60 * 15
      )
      await sendVerification(token, phone)
      res.json({ status: 'success', message: identifier })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'login',
        endpoint: 'post-sendPhoneVerification',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/session', async (req, res) => {
  try {
    if (req.user) res.json({ status: 'success', message: req.user })
    else res.json({ status: 'failed' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'login',
      endpoint: 'get-session',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})
router.get('/logout', (req, res) => {
  try {
    req.logout()
    res.send(200)
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'login',
      endpoint: 'get-logout',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/forgotPassword', isAuth, multer().none(), async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    const forgotPassToken = uuid()
    if (user) {
      await req.redis.setAsync(forgotPassToken, user._id.toString(), 'EX', 60 * 30)
      sendResetPassword(
        email,
        forgotPassToken,
        `${user.firstName} ${user.lastName}`
      )
      res.json({ status: 'success' })
    } else {
      res.json({ status: 'failed', message: 'Email not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'login',
      endpoint: 'post-forgotPassword',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})
router.post('/resetPassword', isAuth, multer().none(), async (req, res) => {
  try {
    const { token, password } = req.body
    const userID = await req.redis.getAsync(token)
    if (userID) {
      const user = await User.findById(userID)
      if (user) {
        user.password = password
        await user.save()
        sendPasswordChanged(user.email, `${user.firstName} ${user.lastName}`)
        res.json({ status: 'success' })
      } else {
        res.json({ status: 'failed', message: 'User not found' })
      }
    } else {
      res.json({ status: 'failed', message: 'Token expired' })
      return
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'login',
      endpoint: 'post-resetPassword',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

module.exports = router
