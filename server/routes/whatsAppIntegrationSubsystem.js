const router = require('express').Router()
const { User, Package, ErrLog, Warehouse } = require('../models')
const moment = require('moment')

function isAuth(req, res, next) {
  if (req.get('X-API-KAIZEN') == 'Y35B4LCWvJExmbfNEjeC') {
    next()
  } else {
    res.json({ status: 'failed', message: 'Wrong API KEY' })
  }
}

router.get('/getUser', isAuth, async (req, res) => {
  try {
    const { phone } = req.query
    const parsedPhone = `+${phone.split('@')[0]}`
    const user = await User.findOne({ phone: parsedPhone, role: 1 })
    if (user) {
      res.json({
        status: 'success',
        message: {
          userID: user._id,
          name: `${user.firstName} ${user.lastName}`,
          type: 'Existing',
        },
      })
    } else {
      res.json({
        status: 'success',
        message: { userID: null, type: 'NonExisting' },
      })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'whatsAppIntegration',
      endpoint: 'get-getUsers',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/warehouses', isAuth, async (req, res) => {
  try {
    const formatAddress = address =>
      `${address.name}, ${address.street}, ${address.city}, ${address.state}, ${address.country}, ${address.zipcode}`

    const { country } = req.query
    const warehouses = await Warehouse.find({ country })
    if (warehouses.length) {
      res.json({
        status: 'success',
        message: warehouses.map(v => ({
          name: v.templateName,
          address: formatAddress(v),
        })),
      })
    } else {
      res.json({ status: 'failed', notfound: true })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'whatsAppIntegration',
      endpoint: 'get-warehouses',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/getPackages', isAuth, async (req, res) => {
  try {
    const { userID } = req.query
    const packages = await Package.find({
      user: userID,
      status: { $nin: ['Picked up', 'Returned', 'Shipped'] },
    }).populate('warehouse')
    if (packages.length) {
      res.json({
        status: 'success',
        message: packages.map(v => ({
          text: `Tracking ID: ${v.trackingNumber} to ${v.warehouse.templateName}`,
        })),
      })
    } else {
      res.json({ status: 'failed', notfound: true })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'whatsAppIntegration',
      endpoint: 'get-getPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/packageByTracking', isAuth, async (req, res) => {
  try {
    const formatAddress = address =>
      `${address.name}, ${address.street}, ${address.city}, ${address.state}, ${address.country}, ${address.zipcode}`
    const { tracking, userID } = req.query
    const package = await Package.findOne({
      trackingNumber: tracking,
      user: userID,
    })
      .populate('shipment')
      .populate('deliveryType')
      .populate('pickupLocation')
    if (package) {
      res.json({
        status: 'success',
        message: {
          trackingNumber: package.trackingNumber,
          weight: package.weight ? package.weight : '??',
          declaredValue: package.declaredValue ? package.declaredValue : '??',
          declaredType: package.declaredType ? package.declaredType : '??',
          deliveryMode: package.deliveryMode,
          arrivalAddress:
            package.deliveryMode == 'Delivery'
              ? formatAddress(package.shippedTo)
              : formatAddress(package.pickupLocation),
          warehouseArrival: !['Pre-Booked', 'Recorded'].includes(package.status)
            ? moment(package.packageArrivedAt).format('YYYY-MM-DD HH:mm')
            : 'Not arrived yet',
          status: package.status,
        },
      })
    } else {
      res.json({ status: 'failed' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'whatsAppIntegration',
      endpoint: 'get-packageByTracking',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

module.exports = router
