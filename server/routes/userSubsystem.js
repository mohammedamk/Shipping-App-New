const router = require('express').Router()
const multer = require('multer')
const bcrypt = require('bcrypt')
const S3 = require('aws-sdk/clients/s3')
const s3 = new S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
})
const multerS3 = require('multer-sharp-s3')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const express = require('express')
const uploadAvatar = multer({
  storage: multerS3({
    s3: s3,
    Bucket: process.env.AWS_BUCKET,
    Key: function (req, file, cb) {
      cb(null, `avatar/${file.originalname}`)
    },
    resize: {
      width: 40,
      height: 40,
    },
    max: true,
  }),
})
const {
  User,
  ErrLog,
  Transaction,
  Package,
  Notification,
  Warehouse,
  Service,
  DeclaredType,
  Invoice,
  DeliveryType,
  Pickup,
  Shipment,
  Settings,
  Ticket,
} = require('../models/index')
const _ = require('lodash')
const moment = require('moment')
const { getFileLink } = require('./../helpers/getCFLink')
const {
  calculateTotalCostWithDiscount,
  bundlePackagesToShipment,
} = require('./../helpers/calculatePrice')
const {
  sendPackageCreatedByUser,
  sendPackagePaid,
} = require('./../helpers/sendMail')

function isAuth(req, res, next) {
  if (req.user && req.user?.role == 1) next()
  else res.json({ status: 'failed', message: 'Invalid role', unauthorized: 1 })
}

const packageAddress = pckg => {
  if (pckg.deliveryMode == 'Delivery') {
    return `${pckg.shippedTo.street}, ${pckg.shippedTo.city}, ${pckg.shippedTo.state}, ${pckg.shippedTo.country}, ${pckg.shippedTo.zipcode}`
  } else {
    return `${pckg.pickupLocation.street}, ${pckg.pickupLocation.city}, ${pckg.pickupLocation.state}, ${pckg.pickupLocation.country}, ${pckg.pickupLocation.zipcode}`
  }
}

router.get('/stats', isAuth, async (req, res) => {
  try {
    const packages = await Package.find({
      status: {
        $in: [
          'Awaiting user actions',
          'Unpaid',
          'Paid',
          'Ready to ship',
          'Awaiting return',
        ],
      },
    }).select('status createdAt')

    const actionRequired = packages.filter(v =>
      ['Awaiting user actions', 'Unpaid'].includes(v.status)
    )
    const readyToShip = packages.filter(v =>
      ['Paid', 'Ready to ship'].includes(v.status)
    )
    const returning = packages.filter(v => v.status == 'Awaiting return')

    res.json({
      status: 'success',
      message: {
        actionRequired: {
          total: actionRequired.length,
          series: [
            {
              name: 'Awaiting user action',
              data: _.chain(actionRequired)
                .groupBy(v => moment(v.createdAt).format('DD'))
                .toPairs()
                .sortBy(v => v[0])
                .map(v => v[1].length)
                .reverse()
                .value(),
            },
          ],
        },
        readyToShip: {
          total: readyToShip.length,
          series: [
            {
              name: 'Ready to ship',
              data: _.chain(readyToShip)
                .groupBy(v => moment(v.createdAt).format('DD'))
                .toPairs()
                .sortBy(v => v[0])
                .map(v => v[1].length)
                .reverse()
                .value(),
            },
          ],
        },
        returning: {
          total: returning.length,
          series: [
            {
              name: 'Returning',
              data: _.chain(returning)
                .groupBy(v => moment(v.createdAt).format('DD'))
                .toPairs()
                .sortBy(v => v[0])
                .map(v => v[1].length)
                .reverse()
                .value(),
            },
          ],
        },
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-stats',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/timeline', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (
        await Notification.find({ userID: req.user._id })
          .limit(20)
          .populate('createdBy')
      ).map(v => ({
        duration: moment(v.createdAt).fromNow(),
        title: v.title,
        subtitle: v.body,
        user: {
          avatar: v.createdBy.avatar,
          name: `${v.createdBy.firstName} ${v.createdBy.lastName}`,
          email: v.createdBy.email,
        },
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-timeline',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/warehouses', isAuth, async (req, res) => {
  try {
    const totalPacks = await Package.find({
      status: {
        $in: [
          'Recorded',
          'Awaiting user Actions',
          'Unpaid',
          'Paid',
          'Ready to ship',
          'Awaiting return',
        ],
      },
    }).select('warehouse')

    const totalPacksConfigured = _.chain(totalPacks)
      .groupBy(v => v.warehouse)
      .value()

    const warehouses = await Warehouse.find({ active: true })

    var warehouseResponse = warehouses.map(v => {
      const totalPacks = totalPacksConfigured[v._id]?.length || 0
      const limitStatusRaw = parseFloat((totalPacks / v.limit) * 100).toFixed(0)
      const limitStatus = isNaN(limitStatusRaw) ? 0 : limitStatusRaw
      return {
        id: v._id,
        countryFlag: getFileLink(v.countryFlag),
        templateName: v.templateName,
        country: v.country,
        limitStatus,
        limit:
          limitStatus < 50
            ? 'green'
            : limitStatus > 50 && limitStatus < 100
            ? 'yellow'
            : 'red',
      }
    })

    res.json({
      status: 'success',
      message: warehouseResponse,
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-warehouses',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/lastWarehouses', isAuth, async (req, res) => {
  try {
    const packages = await Package.find({ user: req.user._id })
      .select('warehouse')
      .limit(20)
    if (packages.length) {
      const uniqueWHs = Array.from(new Set(packages.map(v => v.warehouse)))
      let warehouses = (await Warehouse.find({ _id: { $in: uniqueWHs } })).map(
        v => ({
          id: v._id,
          countryFlag: getFileLink(v.countryFlag),
          templateName: v.templateName,
        })
      )
      if (warehouses.length > 5) {
        warehouses = warehouses.slice(0, 5)
      }
      res.json({
        status: 'success',
        message: warehouses,
      })
    } else {
      res.json({ status: 'success', message: [] })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-warehouses',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/warehouse', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const warehouse = await Warehouse.findById(id)
    if (warehouse) {
      res.json({
        status: 'success',
        message: {
          name: warehouse.name,
          city: warehouse.city,
          country: warehouse.country,
          state: warehouse.state,
          street: warehouse.street,
          zipcode: warehouse.zipcode,
        },
      })
    } else {
      res.json({ status: 'failed', message: 'Warehouse not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-warehouse',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/settings',
  isAuth,
  uploadAvatar.single('avatar'),
  async (req, res) => {
    try {
      const { firstName, lastName, email, phone } = req.body
      const user = await User.findById(req.user._id)
      if (user) {
        user.firstName = firstName
        user.lastName = lastName
        user.email = email
        user.phone = phone
        if (req.file) {
          user.avatar = req.file.key
        }
        await user.save()
        res.json({ status: 'success', message: 'Setting successfully updated' })
      } else {
        res.json({ status: 'failed', message: 'User not found' })
      }
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'user',
        endpoint: 'post-settings',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/changeAddress', isAuth, multer().none(), async (req, res) => {
  try {
    const { street, city, state, country, zipcode } = req.body
    await User.findByIdAndUpdate(req.user._id, {
      street,
      city,
      state,
      country,
      zipcode,
    })
    res.json({ status: 'success', message: 'Address changed successfully' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-changeAddress',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/changePassword', isAuth, multer().none(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.user._id)
    if (user) {
      if (bcrypt.compareSync(currentPassword, user.password)) {
        user.password = newPassword
        await user.save()
        res.json({
          status: 'success',
          message: 'Password changed successfully',
        })
      } else {
        res.json({ status: 'failed', message: 'Wrong password' })
      }
    } else {
      res.json({ status: 'failed', message: 'User not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-settings',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/services', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await Service.find({ active: true })).map(v => ({
        id: v._id,
        name: v.name,
        priceType: v.priceType,
        declaredType: v.declaredType,
        price: v.priceValue,
        required: v.required,
        deliveryMode: v.deliveryMode,
        deliveryType: v.deliveryType,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-packages',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/declaredTypes', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await DeclaredType.find({ active: true })).map(v => ({
        id: v._id,
        name: v.name,
        subTypes: v.subTypes,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-packages',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/confirmPackage', isAuth, multer().none(), async (req, res) => {
  try {
    const { packageID, deliveryMode, pickupLocation, deliveryType } = req.body
    const package = await Package.findById(packageID)
    if (package) {
      if (package.user.toString() == req.user._id.toString()) {
        package.deliveryMode = deliveryMode
        if (deliveryMode == 'Pickup') {
          package.pickupLocation = pickupLocation
        } else {
          package.shippedTo = {
            city: req.user?.city,
            country: req.user?.country,
            state: req.user?.state,
            street: req.user?.street,
            zipcode: req.user?.zipcode,
            name: `${req.user?.firstName} ${req.user?.lastName}`,
          }
          package.deliveryType = deliveryType
        }
        if (package.status == 'Pre-Booked' && package.packageArrivedAt) {
          package.status = 'Arrived at warehouse'
        } else {
          package.status = 'Recorded'
        }
        await package.save()
        await Notification.create({
          userID: req.user._id,
          title: 'Package confirmed',
          message: `Package #${package.trackingNumber} successfully confirmed`,
          createdBy: req.user._id,
        })
        res.json({ status: 'success' })
      } else {
        res.json({ status: 'failed', message: 'Package not owned by the user' })
      }
    } else {
      res.json({ status: 'failed', message: 'No package found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-confirmPackage',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/package', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const package = await Package.findById(id).populate('warehouse')
    if (package) {
      if (package.user.toString() == req.user._id.toString()) {
        res.json({
          status: 'success',
          message: {
            id: package._id,
            warehouse: {
              id: package.warehouse._id,
              templateName: package.warehouse.templateName,
            },
            trackingNumber: package.trackingNumber,
          },
        })
      } else {
        res.json({ status: 'failed', message: 'Package not owned by the user' })
      }
    } else {
      res.json({ status: 'failed', message: 'No package found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-package',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/packages', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (
        await Package.find({ user: req.user._id })
          .populate('warehouse')
          .populate('transaction')
          .populate('deliveryType')
      ).map(v => ({
        id: v._id,
        fromAddress:
          v.deliveryMode == 'Delivery'
            ? {
                name: v.shippedTo.name,
                street: v.shippedTo.street,
                city: v.shippedTo.city,
                state: v.shippedTo.state,
                country: v.shippedTo.country,
                zipcode: v.shippedTo.zipcode,
              }
            : {},
        services: v.extraServices,
        trackingNumber: v.trackingNumber,
        deliveryMode: v.deliveryMode,
        flatRate: v.flatRate,
        deliveryType:
          v.deliveryMode == 'Delivery'
            ? {
                id: v.deliveryType._id,
                name: v.deliveryType.name,
              }
            : {},
        toWarehouse: {
          city: v.warehouse.city,
          country: v.warehouse.country,
          state: v.warehouse.state,
          street: v.warehouse.street,
          zipcode: v.warehouse.zipcode,
          name: v.warehouse.name,
          templateName: v.warehouse.templateName,
        },
        weight: v.weight,
        declaredValue: v.declaredValue,
        status: v.status,
        invoiceID: v.invoiceID,
        totalCost: v.logisticsCost,
        packageArrivedAt: v.packageArrivedAt,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-packages',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/package', isAuth, multer().none(), async (req, res) => {
  try {
    const {
      warehouseID,
      trackingNumber,
      deliveryMode,
      pickupLocation,
      deliveryType,
    } = req.body
    const warehouse = await Warehouse.findById(warehouseID)
    if (warehouse) {
      const package = await Package.create({
        user: req.user._id,
        warehouse: warehouse._id,
        trackingNumber,
        status: 'Recorded',
        deliveryMode,
      })
      if (deliveryMode == 'Delivery') {
        package['shippedTo'] = {
          city: req.user?.city,
          country: req.user?.country,
          state: req.user?.state,
          street: req.user?.street,
          zipcode: req.user?.zipcode,
          name: `${req.user?.firstName} ${req.user?.lastName}`,
        }
        package['deliveryType'] = deliveryType
      } else if (deliveryMode == 'Pickup') {
        package['pickupLocation'] = pickupLocation
        var pickupLocationObject = await Pickup.findById(pickupLocation)
      }

      await package.save()
      sendPackageCreatedByUser(
        req.user.email,
        `${req.user.firstName} ${req.user.lastName}`,
        trackingNumber,
        deliveryMode,
        packageAddress(package),
        warehouse.templateName,
        package
      )
      await Notification.create({
        userID: req.user._id,
        title: 'Package created',
        message: `New package towards ${warehouse.templateName} successfully created`,
        createdBy: req.user._id,
      })
      res.json({ status: 'success' })
    } else {
      res.json({ status: 'failed', message: 'Warehouse not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-package',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/cancelPackage', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    const package = await Package.findById(id).populate('warehouse')
    if (package) {
      if (package.user.toString() === req.user._id.toString()) {
        if (
          ['Recorded', 'Awaiting user actions', 'Unpaid'].includes(
            package.status
          )
        ) {
          package.status = 'Awaiting return'
          await package.save()
          await Notification.create({
            userID: req.user._id,
            title: 'Package cancelled',
            message: `Package towards ${package.warehouse.templateName} successfully cancelled`,
            createdBy: req.user._id,
          })
          res.json({
            status: 'success',
            message: 'Package cancelled successfully',
          })
        } else {
          res.json({
            status: 'failed',
            message: `Sorry, ${package.status} can't be cancelled`,
          })
        }
      } else {
        res.json({
          status: 'failed',
          message: 'You are not the owner of this package',
        })
      }
    } else {
      res.json({ status: 'failed', message: 'Package not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-cancelPackage',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/declarePackageValue',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id, declaredValue } = req.body
      const package = await Package.findById(id)

      if (package) {
        if (package.user.toString() === req.user._id.toString()) {
          package.declaredValue = declaredValue
          package.status = 'Unpaid'
          await package.save()
          res.json({
            status: 'success',
            message: 'Package declared successfully',
          })
        } else {
          res.json({
            status: 'failed',
            message: 'You are not the owner of this package',
          })
        }
      } else {
        res.json({
          status: 'failed',
          message: 'Package not found',
        })
      }
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'user',
        endpoint: 'post-cancelPackage',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/getPayID', isAuth, multer().none(), async (req, res) => {
  try {
    const { cart } = req.body
    const cartData = JSON.parse(cart)
    let lineItems = []
    if (!cartData.length) {
      res.json({ status: 'failed', message: 'No package to pay' })
      return
    }
    const invoice = await Invoice.create({
      customer: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        address: `${req.user.street}, ${req.user.city}, ${req.user.state}`,
        address2: `${req.user.country}, ${req.user.zipcode}`,
        email: req.user.email,
      },
    })
    const totalCostObj = await calculateTotalCostWithDiscount(cartData)
    invoice.totalWithoutDiscount = totalCostObj.subtotal
    invoice.discount = totalCostObj.discount
    invoice.itemList = totalCostObj.invoiceLines
    await invoice.save()

    const transaction = await Transaction.create({
      userID: req.user._id,
      amount: totalCostObj.total,
      status: 'Unpaid',
    })

    const bundles = await bundlePackagesToShipment(cartData.map(v => v.id))
    for (let t = 0; t < bundles.length; t++) {
      await Shipment.create({
        packageIDs: bundles[t].map(v => v.id),
        transactionID: transaction._id,
        invoiceID: invoice._id,
        userID: req.user._id,
        warehouse: bundles[t][0]?.warehouse,
        deliveryMode: bundles[t][0]?.deliveryMode,
      })
    }

    for (var i = 0; i < cartData.length; i++) {
      let currentCartItem = cartData[i]
      let package = await Package.findById(currentCartItem.id).populate(
        'transaction'
      )
      package.declaredType = currentCartItem.declaredType
      package.declaredValue = currentCartItem.declaredValue
      package.invoiceID = invoice._id
      package.confirmedServices = currentCartItem.services
      await package.save()
    }

    lineItems.push({
      currency: 'USD',
      name: `Payment for invoice #${invoice.invoiceNr}`,
      amount: parseInt(transaction.amount) * 100,
      quantity: 1,
    })

    const session = await stripe.checkout.sessions.create({
      success_url: `${process.env.CLIENT_URL}/customer/packages?payment=success`,
      cancel_url: `${process.env.CLIENT_URL}/customer/packages?payment=cancel`,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      metadata: {
        transactionID: transaction._id.toString(),
      },
    })
    res.json({ status: 'success', message: session.id })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-getPayID',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.post('/paymentHook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature']

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET_KEY
    )

    if (event.type == 'checkout.session.completed') {
      const transactionID = event.data.object?.metadata?.transactionID
      if (!transactionID) {
        return
      }
      const transaction = await Transaction.findById(transactionID)
      if (transaction) {
        transaction.status = 'Paid'
        transaction.paidAt = Date.now()
        await transaction.save()
        const shipment = await Shipment.find({ transactionID: transaction._id })

        if (shipment.length) {
          for (var t = 0; t < shipment.length; t++) {
            const packages = await Package.find({ _id: shipment[t].packageIDs })
              .populate('user')
              .populate('pickupLocation')
              .populate('warehouse')
            if (packages.length) {
              for (var i = 0; i < packages.length; i++) {
                packages[i].status = 'Paid'
                packages[i].paidAt = Date.now()

                await packages[i].save()
                const package = packages[i]


                sendPackagePaid(
                  package.user.email,
                  `${package.user.firstName} ${package.user.lastName}`,
                  package.trackingNumber,
                  package.deliveryMode,
                  packageAddress(package),
                  package.warehouse.templateName,
                  package.weight,
                  package
                )


              }
            }
          }
        }

        await Notification.create({
          userID: transaction.userID,
          title: 'Payment Received',
          message: `A payment has been confirmed for the amount of ${transaction.amount}`,
          createdBy: transaction.userID,
        })
        //Send mail that confirms the payment
        res.json({ status: 'success' })
      }
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-paymentHook',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.get('/invoice', isAuth, async (req, res) => {
  try {
    const { id } = req.query

    const invoice = await Invoice.findById(id)

    res.json({
      status: 'success',
      message: {
        customer: invoice.customer,
        dataIssued: moment(invoice.dataIssued).format('YYYY-MM-DD'),
        discount: invoice.discount,
        invoiceNr: invoice.invoiceNr,
        itemList: invoice.itemList,
        totalWithoutDiscount: invoice.totalWithoutDiscount,
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-invoice',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/availableCountries', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await Warehouse.find({ active: true })).map(v => v.country),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-availableCountries',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/deliveryTypeSelect', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await DeliveryType.find({ active: true })).map(v => ({
        id: v._id,
        name: v.name,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-deliveryTypeSelect',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/pickupLocations', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await Pickup.find({ active: true })).map(v => ({
        id: v._id,
        name: v.name,
        country: v.country,
        state: v.state,
        fullAddress: `${v.street}, ${v.city}, ${v.state}, ${v.country}, ${v.zipcode}`,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-pickupLocations',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/packageSettings', isAuth, async (req, res) => {
  try {
    const wSettings = await Settings.find({
      name: { $in: ['freeDeposit', 'costPerKgDeposit'] },
    })
    res.json({
      status: 'success',
      message: {
        freeDeposit: wSettings.find(v => v.name == 'freeDeposit')['value'],
        costPerKgDeposit: wSettings.find(v => v.name == 'costPerKgDeposit')[
          'value'
        ],
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-packageSettings',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/tickets', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await Ticket.find({ createdBy: req.user._id })).map(v => ({
        id: v._id,
        subject: v.subject,
        createdAt: v.createdAt,
        status: v.status,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-tickets',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/ticket', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const ticket = await Ticket.findById(id).populate('messageList.author')
    if (ticket) {
      res.json({
        status: 'success',
        message: {
          id: ticket._id,
          name: ticket.subject,
          status: ticket.status,
          messages: ticket.messageList.map(v => ({
            userType:
              v.author._id.toString() == req.user._id.toString()
                ? 'Self'
                : 'Staff',
            body: v.text,
            time: v.wroteAt,
            user: {
              avatar: getFileLink(v.author.avatar),
              name: `${v.author.firstName} ${v.author.lastName}`,
              email: v.author.email,
            },
          })),
        },
      })
    } else {
      res.json({ status: 'failed', message: 'No ticket found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'get-ticket',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/ticket', isAuth, multer().none(), async (req, res) => {
  try {
    const { subject, body } = req.body
    await Ticket.create({
      createdBy: req.user._id,
      subject,
      messageList: [
        {
          text: body,
          author: req.user._id,
          wroteAt: Date.now(),
        },
      ],
    })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-ticket',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/editTicket', isAuth, multer().none(), async (req, res) => {
  try {
    const { body, ticketStatus, id } = req.body
    if (ticketStatus != 2 && body == 'null') {
      res.json({
        status: 'failed',
        message: 'Body is required if ticket is not closed',
      })
      return
    }
    const ticket = await Ticket.findById(id)
    if (ticket) {
      if (ticket.status == 'Closed') {
        res.json({ status: 'failed', message: "Can't update a closed ticket" })
        return
      }
      if (ticketStatus == 2) {
        ticket.status = 'Closed'
        ticket.solvedAt = Date.now()
      } else {
        if (ticket.status != 'Created') {
          ticket.status = 'Awaiting support response'
        }
        ticket.messageList.push({
          text: body,
          author: req.user._id,
          wroteAt: Date.now(),
        })
      }
      await ticket.save()
      res.json({ status: 'success' })
    } else {
      res.json({ status: 'failed', message: 'Ticket not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'user',
      endpoint: 'post-editTicket',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

module.exports = router
