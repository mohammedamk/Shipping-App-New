const router = require('express').Router()
const multer = require('multer')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const moment = require('moment')
const {
  User,
  ErrLog,
  Package,
  Notification,
  Warehouse,
  Service,
  Shipment,
  Settings,
} = require('../models/index')
const { calculatePrice } = require('../helpers/calculatePrice')
const {
  sendPackageCreatedByLogistics,
  sendPackageArrived,
  sendPackageOutOnDelivery,
  sendPackagePickedUp,
  sendPackageReadyToPickup,
  sendPackageReadyToShip,
  sendPackageRequiresAction,
  sendPackageShipped,
} = require('../helpers/sendMail')

require('dotenv').config()

function isAuth(req, res, next) {
  if (req.logisticsID) next()
  else
    res.json({
      status: 'failed',
      message: 'Wrong username or password, or invalid role',
      unauthorized: 1,
    })
}
function isNotAuthenticated(req, res, next) {
  if (!req.logisticsID) next()
  else
    res.json({
      status: 'failed',
      message: 'Already logged in',
      unauthorized: 1,
    })
}

const packageAddress = pckg => {
  if (pckg.deliveryMode == 'Delivery') {
    return `${pckg.shippedTo.street}, ${pckg.shippedTo.city}, ${pckg.shippedTo.state}, ${pckg.shippedTo.country}, ${pckg.shippedTo.zipcode}`
  } else {
    return `${pckg.pickupLocation.street}, ${pckg.pickupLocation.city}, ${pckg.pickupLocation.state}, ${pckg.pickupLocation.country}, ${pckg.pickupLocation.zipcode}`
  }
}

router.post('/login', isNotAuthenticated, multer().none(), async (req, res) => {
  try {
    var { email, password } = req.body
    var user = await User.findOne({ email })
    if (!user) {
      res.json({ status: 'failed', message: 'Wrong username or password' })
      return
    }
    if (bcrypt.compareSync(password, user.password)) {
      var jwtToken = jwt.sign(
        { logisticsID: user._id },
        'KaizenJBqPnEOtMcShippingLogistics'
      )
      res.json({ status: 'success', message: jwtToken })
    } else {
      res.json({ status: 'failed', message: 'Wrong username or password' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-login',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/warehouses', async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await Warehouse.find({ active: true })).map(v => ({
        id: v._id,
        name: v.templateName,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-warehouses',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.get('/toShipPackages', isAuth, async (req, res) => {
  try {
    const shipments = await Shipment.find({ status: 'Created' })
    let responseObject = []
    for (var i = 0; i < shipments.length; i++) {
      const shipment = shipments[i]
      if (shipment.packageIDs.length) {
        const package = await Package.findById(shipment.packageIDs[0])
          .populate('user')
          .populate('deliveryType')
          .populate('pickupLocation')
        if (package) {
          responseObject.push({
            id: shipment._id,
            name: `${package.user.firstName} ${package.user.lastName}`,
            shippedTo: package.shippedTo,
            deliveryMode: package.deliveryMode,
            pickupLocation:
              package.deliveryMode == 'Pickup'
                ? {
                    name: package.pickupLocation.name,
                    address: `${package.pickupLocation.street}, ${package.pickupLocation.city}, ${package.pickupLocation.state}, ${package.pickupLocation.country}, ${package.pickupLocation.zipcode}`,
                  }
                : undefined,
            deliveryType: package.deliveryType?.name,
            trackingNumbers: (
              await Package.find({
                _id: shipment.packageIDs,
              }).select('trackingNumber')
            ).map(v => v.trackingNumber),
            shipmentUID: shipment.shipmentUniqueID,
            createdAt: moment(package.createdAt).format('DD-MM-YYYY'),
          })
        }
      }
    }
    res.json({ status: 'success', message: responseObject })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-toShipPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.get('/confirmationPackages', isAuth, async (req, res) => {
  try {
    const { warehouse } = req.query
    res.json({
      status: 'success',
      message: (
        await Package.find({
          status: 'Arrived at warehouse',
          warehouse,
        }).populate('user')
      ).map(v => ({
        id: v._id,
        name: `${v.user.firstName} ${v.user.lastName}`,
        trackingNumber: v.trackingNumber,
        createdAt: moment(v.createdAt).format('DD-MM-YYYY'),
        deliveryMode: v.deliveryMode,
        deliveryType: v.deliveryMode == 'Delivery' ? v.deliveryType : null,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-confirmationPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/packageByTN', isAuth, async (req, res) => {
  try {
    const { trackingNumber } = req.query
    const package = await Package.findOne({
      trackingNumber,
      status: 'Recorded',
    }).populate('user')
    if (package) {
      res.json({
        status: 'success',
        message: {
          id: package._id,
          uID: package.user.uID,
          customerName: `${package.user.firstName} ${package.user.lastName}`,
        },
      })
    } else {
      res.json({ status: 'failed', notFound: 1 })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-packageByTN',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/returningPackages', isAuth, async (req, res) => {
  try {
    const { warehouse } = req.query
    res.json({
      status: 'success',
      message: (
        await Package.find({ status: 'Awaiting return', warehouse })
      ).map(v => ({
        id: v._id,
        name: v.shippedTo.name,
        trackingNumber: v.trackingNumber,
        createdAt: moment(v.createdAt).format('DD-MM-YYYY'),
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-confirmationPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/services', isAuth, async (req, res) => {
  try {
    const { warehouse } = req.query
    res.json({
      status: 'success',
      message: (
        await Service.find({
          toWarehouse: warehouse,
          active: true,
          required: false,
        })
      ).map(v => ({
        id: v._id,
        name: v.name,
        priceType: v.priceType,
        price: v.priceValue,
        deliveryMode: v.deliveryMode,
        deliveryType: v.deliveryMode == 'Delivery' ? v.deliveryType : null,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-confirmationPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/askDeclaredValue', isAuth, multer().none(), async (req, res) => {
  try {
    const { id, weight, service } = req.body
    const package = await Package.findById(id)
      .populate('warehouse')
      .populate('user')
      .populate('pickupLocation')
    if (package) {
      const costResult = await calculatePrice(package, weight)
      if (costResult.status == 'failed') {
        res.json({ status: 'failed', message: costResult.message })
        return
      }
      package.logisticsCost = costResult.message.total
      if (costResult.message.flatRate > 0) {
        package.flatRate = costResult.message.flatRate
      }
      package.extraServices = service
      package.weight = weight
      package.logistics = req.logisticsID
      package.status = 'Awaiting user actions'
      await package.save()

      sendPackageRequiresAction(
        package.user.email,
        `${package.user.firstName} ${package.user.lastName}`,
        package.trackingNumber,
        package.deliveryMode,
        packageAddress(package),
        package.warehouse.templateName,
        package.weight,
        package
      )

      await Notification.create({
        userID: package.user,
        title: 'Package status change',
        message: `Package at ${package.warehouse.templateName} changed status to 'Awaiting user actions'`,
        createdBy: req.logisticsID,
      })
      res.json({ status: 'success', message: 'Package status changed' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-askDeclaredValue',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/markAsArrived', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    const package = await Package.findById(id).populate('user').populate('pickupLocation').populate('warehouse');

    if (package && package.status == 'Recorded') {
      package.status = 'Arrived at warehouse'
      package.packageArrivedAt = Date.now()
      await package.save()
      sendPackageArrived(
        package.user.email,
        `${package.user.firstName} ${package.user.lastName}`,
        package.trackingNumber,
        package.deliveryMode,
        packageAddress(package),
        package.warehouse.templateName,
        package
      )
      await Notification.create({
        userID: package.user,
        title: 'Package status change',
        message: `Package at ${package.warehouse.templateName} changed status to 'Arrived'`,
        createdBy: req.logisticsID,
      })
      res.json({
        status: 'success',
        message: 'Package successfully marked as arrived',
      })
    } else {
      res.json({
        status: 'failed',
        message: 'Package not found or is not Recorded',
      })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-markAsArrived',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/markAsPreparedToReturn',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id } = req.body
      const package = await Package.findById(id).populate('warehouse')
      if (package) {
        if (package.status == 'Recorded') {
          package.status = 'Awaiting return'
          await package.save()
          await Notification.create({
            userID: package.user,
            title: 'Package status change',
            message: `Package at ${package.warehouse.templateName} changed status to 'Awaiting return'`,
            createdBy: req.logisticsID,
          })
          res.json({
            status: 'success',
            message: 'Shipment marked as awaiting return',
          })
        } else {
          res.json({
            status: 'failed',
            message: 'Package is not in "recorded" status',
          })
        }
      } else {
        res.json({ status: 'failed', message: 'Package not found' })
      }
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'logistics',
        endpoint: 'post-markAsPreparedToReturn',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)


router.post(
  '/markAsReadyToShipped',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id } = req.body
      const shipment = await Shipment.findById(id)
        .populate('warehouse')
        .populate('userID')
        .populate('packageIDs')
      if (shipment) {
        for (var i = 0; i < shipment.packageIDs.length; i++) {
          const package = await Package.findById(shipment.packageIDs[i])
            .populate('warehouse')
            .populate('pickupLocation')

          if (package.status == 'Paid') {
            package.status        = shipment.deliveryMode == 'Delivery' ? 'Ready to ship' : 'Ready to pickup'
            package.readyToShipAt = Date.now()
            await package.save()
            if (shipment.deliveryMode == 'Delivery') {
              sendPackageReadyToShip(
                shipment.userID.email,
                `${shipment.userID.firstName} ${shipment.userID.lastName}`,
                package.trackingNumber,
                package.deliveryMode,
                packageAddress(package),
                package.warehouse.templateName,
                package.weight,
                package
              )
            } else {
              // For Pickup
              sendPackageReadyToPickup(
                shipment.userID.email,
                `${shipment.userID.firstName} ${shipment.userID.lastName}`,
                package.trackingNumber,
                package.deliveryMode,
                packageAddress(package),
                package.warehouse.templateName,
                package.weight,
                package
              )
            }
            await Notification.create({
              userID: package.user,
              title: 'Package status change',
              message:
                shipment.deliveryMode == 'Delivery'
                  ? `Package at ${package.warehouse.templateName} changed status to 'Ready to ship'`
                  : `Package at ${package.warehouse.templateName} changed status to 'Ready to pickup'`,
              createdBy: req.logisticsID,
            })
          }
        }

        if (shipment.deliveryMode == 'Delivery') {
          const customerAddressArray = shipment.packageIDs[0].shippedTo;
          const client = new (require('tookan-api').Client)({
            api_key: process.env.Tookan_key,
          })
          const taskResponse = await client.createTask({
            order_id: shipment._id,
            team_id: 979497,
            auto_assignment: 0,
            job_description: `Delivery of ${shipment.shipmentUniqueID}`,
            job_pickup_phone: shipment.warehouse.phone,
            job_pickup_name: shipment.warehouse.name,
            job_pickup_address: `${shipment.warehouse.street}, ${shipment.warehouse.city}, ${shipment.warehouse.state}, ${shipment.warehouse.country}, ${shipment.warehouse.zipcode}`,
            job_pickup_datetime: moment().format('YYYY-MM-DD HH:mm'),
            customer_email: shipment.userID.email,
            customer_username: `${shipment.userID.firstName} ${shipment.userID.lastName}`,
            customer_phone: shipment.userID.phone,
            customer_address: `${customerAddressArray.street}, ${customerAddressArray.city}, ${customerAddressArray.state}, ${customerAddressArray.country}, ${customerAddressArray.zipcode}`,
            job_delivery_datetime: moment().format('YYYY-MM-DD HH:mm'),
            timezone: 480,
            has_pickup: 1,
            has_delivery: 1,
            layout_type: 0,
            tracking_link: 0,
            notify: 1,
            geofence: 0,
            ride_type: 0,
          })
          if (taskResponse.status == 200) {
            shipment.status = 'Started'
            await shipment.save()
          } else {
            ErrLog.create({
              message: taskResponse.message,
              name: 'Job creation ERROR',
              subsystem: 'tookanAPI',
              endpoint: 'post-markAsReadyToShipped',
              stack: 'tookanAPI',
            }).catch(err2 => {
              console.log(err2)
            })
            res.json({ status: 'failed', message: 'Shipment not found' })
            return
          }
        } else {
          shipment.status = 'Started'
          await shipment.save()
        }
        res.json({
          status: 'success',
          message: 'Shipment marked as ready to ship',
        })
      } else {
        res.json({ status: 'failed', message: 'Shipment not found' })
      }
    } catch (err) {

      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'logistics',
        endpoint: 'post-markAsReadyToShipped',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)


router.post('/markAsReturned', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    const package = await Package.findById(id).populate('warehouse')
    if (package) {
      if (
        [
          'Awaiting return',
          'Recorded',
          'Awaiting user actions',
          'Unpaid',
        ].includes(package.status)
      ) {
        package.status = 'Returned'
        await package.save()
        await Notification.create({
          userID: package.user,
          title: 'Package status change',
          message: `Package at ${package.warehouse.templateName} changed status to 'Returned'`,
          createdBy: req.logisticsID,
        })
        res.json({ status: 'success', message: 'Package marked as returned' })
      } else {
        res.json({
          status: 'failed',
          message: 'Package is not in the proper status to be returned',
        })
      }
    } else {
      res.json({ status: 'failed', message: 'Package not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-markAsReturned',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/customers', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await User.find({ role: 1, enabled: true })).map(v => ({
        id: v._id,
        name: `${v.firstName} ${v.lastName}`,
        uID: v.uID,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-customers',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.post('/createPackage', isAuth, multer().none(), async (req, res) => {
  try {
    const { trackingNumber, userID, warehouse } = req.body
    const package = await Package.create({
      user: userID,
      logistics: req.logisticsID,
      warehouse,
      trackingNumber,
      status: 'Pre-Booked',
      packageArrivedAt: Date.now(),
    })
    const wh    = await Warehouse.findById(warehouse)
    const user  = await User.findById(userID)
    sendPackageCreatedByLogistics(
      user.email,
      `${user.firstName} ${user.lastName}`,
      trackingNumber,
      wh.templateName,
      package.createdAt
    )
    await Notification.create({
      userID: userID,
      title: 'Package created',
      message: `New package towards ${wh.templateName} successfully created`,
      createdBy: req.logisticsID,
    })
    res.json({ status: 'success', message: 'Package added successfully' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-createPackage',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.post('/packageStatusChange', multer().none(), async (req, res) => {
  try {
    // const { job_type, order_id, job_status, tookan_shared_secret } = req.body;
    const { job_type, order_id, job_status } = req.body;


    // if ( tookan_shared_secret == process.env.Tookan_shared_secret ) {
      const shipment = await Shipment.findById(order_id).populate('userID')

      if (shipment) {
        if (job_type == '0' && job_status == '1') {

          // for (var i = 0; i < shipment.packageIDs.length; i++) {
          const package             = await Package.findById(shipment.packageIDs[0]._id).populate('warehouse').populate('pickupLocation')
          package.status            = 'Out for delivery'
          package.outForDeliveryAt  = Date.now()
          await package.save()
          sendPackageOutOnDelivery(
            shipment.userID.email,
            `${shipment.userID.firstName} ${shipment.userID.lastName}`,
            package.trackingNumber,
            package.deliveryMode,
            packageAddress(package),
            package.warehouse.templateName,
            package.weight,
            package
          )
          await Notification.create({
            userID: package.user,
            title: 'Package status change',
            message: `Package at ${package.warehouse.templateName} changed status to 'Out for delivery'`,
          })
          res.json({
            status: 'success',
            message: 'Package marked as out for delivery',
          })
          // }

        } else if (job_type == '1' && job_status == '2') {

          // for (var i = 0; i < shipment.packageIDs.length; i++) {
          const package     = await Package.findById(shipment.packageIDs[0]._id).populate('warehouse').populate('pickupLocation')
          package.status    = 'Shipped'
          package.shippedAt = Date.now()
          await package.save()

          shipment.status = 'Successful'
          await shipment.save()
          sendPackageShipped(
            shipment.userID.email,
            `${shipment.userID.firstName} ${shipment.userID.lastName}`,
            package.trackingNumber,
            package.deliveryMode,
            packageAddress(package),
            package.warehouse.templateName,
            package.weight,
            package
          )
          await Notification.create({
            userID: package.user,
            title: 'Package status change',
            message: `Package at ${package.warehouse.templateName} changed status to 'Shipped'`,
          })
          res.json({
            status: 'success',
            message: 'Package marked as Shipped',
          })
          // }
        }
      }
    // }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-packageStatusChange',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.get('/readyToPickupPackages', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (
        await Shipment.find({ deliveryMode: 'Pickup', status: 'Started' })
          .populate('packageIDs')
          .populate('userID')
      ).map(v => ({
        id: v._id,
        shipmentUID: v.shipmentUniqueID,
        trackingNumber: v.packageIDs[0].trackingNumber,
        name: `${v.userID.firstName} ${v.userID.lastName}`,
        createdAt: v.createdAt,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-readyToPickupPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.get('/readyToDeliverPackages', isAuth, async (req, res) => {

  const shipments = await Shipment.find({ deliveryMode: 'Delivery', status: 'Started' }).populate('packageIDs').populate('userID');

  try {
    res.json({
      status: 'success',
      message: (
        shipments
      ).map(v => ({
        id: v._id,
        shipmentUID: v.shipmentUniqueID,
        trackingNumber: v.packageIDs[0].trackingNumber,
        status: v.packageIDs[0].status,
        name: `${v.userID.firstName} ${v.userID.lastName}`,
        createdAt: v.createdAt
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'get-readyToDeliverPackages',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.post('/markAsPickup', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    const shipment = await Shipment.findById(id)
      .populate('packageIDs')
      .populate('userID')
    if (shipment) {
      const package = await Package.findById(shipment.packageIDs[0]._id)
        .populate('pickupLocation')
        .populate('warehouse')
      if (package) {
        if ( package.status == 'Ready to pickup' ) {
          package.status      = 'Picked up'
          package.pickedupAt  = Date.now()
          await package.save()
          shipment.status = 'Successful'
          await shipment.save()
          sendPackagePickedUp(
            shipment.userID.email,
            `${shipment.userID.firstName} ${shipment.userID.lastName}`,
            package.trackingNumber,
            package.deliveryMode,
            packageAddress(package),
            package.warehouse.templateName,
            package.weight,
            package
          )
          await Notification.create({
            userID: package.user,
            title: 'Package status change',
            message: `Package at ${package.warehouse.templateName} changed status to 'Picked up'`,
            createdBy: req.logisticsID,
          })
          res.json({
            status: 'success',
            message: 'Package marked as picked up',
          })
        } else {
          res.json({
            status: 'failed',
            message: 'Package is not in the proper status to be picked up',
          })
        }
      } else {
        res.json({ status: 'failed', message: 'Package not found' })
      }
    } else {
      res.json({ status: 'failed', message: 'Shipment not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'logistics',
      endpoint: 'post-markAsPickup',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

module.exports = router
