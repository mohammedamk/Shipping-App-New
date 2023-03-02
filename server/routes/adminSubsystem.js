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
const multerS3NoImage = require('multer-s3')
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
const { Readable } = require('stream')
const uploadFlag = multer({
  storage: multerS3({
    s3: s3,
    Bucket: process.env.AWS_BUCKET,
    Key: function (req, file, cb) {
      cb(null, `warehouseFlags/${file.originalname}`)
    },
    resize: {
      width: 42,
      height: 42,
    },
    max: true,
  }),
})
const {
  User,
  ErrLog,
  Transaction,
  Package,
  Ticket,
  Notification,
  Settings,
  Warehouse,
  DeclaredType,
  Price,
  Service,
  Invoice,
  Pickup,
  DeliveryType,
} = require('../models/index')
const _ = require('lodash')
const moment = require('moment')
const { uuid } = require('uuidv4')
const { sendWelcomeEmailToUser, sendResetPasswordByAdmin } = require('../helpers/sendMail')
const { getFileLink } = require('./../helpers/getCFLink')
const generateExcelReport = require('./../helpers/generateExcelReport')

function isAuth(req, res, next) {
  if (req.user && req.user?.role == 0) next()
  else res.json({ status: 'failed', message: 'Invalid role', unauthorized: 1 })
}

router.get('/transactions', isAuth, async (req, res) => {
  try {
    var {
      query,
      status,
      page,
      perPage,
      sortBy = 'client',
      sortDesc = 0,
    } = req.query
    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'transactionStatus':
        sortObject['status'] = trueSortDesc
        break
      case 'total':
        sortObject['amount'] = trueSortDesc
        break
      case 'status':
        sortObject['status'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['status'] = status
    }
    let transactions = await Transaction.find({ ...filterObject })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))
      .populate({ path: 'userID' })
    if (sortBy === 'client') {
      transactions.sort((firstEl, secondEl) => {
        if (trueSortDesc === 'asc') {
          return firstEl.userID.firstName
            .toString()
            .toLowerCase()
            .localeCompare(secondEl.userID.firstName.toString().toLowerCase())
        } else {
          return secondEl.userID.firstName
            .toString()
            .toLowerCase()
            .localeCompare(firstEl.userID.firstName.toString().toLowerCase())
        }
      })
    }
    if (query) {
      transactions = transactions.filter(v =>
        v.userID.firstName
          .toString()
          .toLowerCase()
          .search(query.toString().toLowerCase())
      )
    }
    res.json({
      status: 'success',
      message: transactions.map(v => ({
        transactionStatus: v.status,
        client: {
          name: `${v.userID.firstName} ${v.userID.lastName}`,
          email: `${v.userID.email}`,
          avatar: getFileLink(v.userID.avatar),
          id: v.userID._id,
        },
        total: v.amount,
        paidAt: moment(v.paidAt).format('DD-MM-YY hh:mm'),
        id: v._id,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-transactions',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/mainStats', isAuth, async (req, res) => {
  try {
    let { supportDate, packageDate } = req.query
    let supportActual = null
    let packageActual = null
    switch (supportDate) {
      case 'Last 5 days':
        supportActual = moment().subtract(5, 'days')
        break
      case 'Last Month':
        supportActual = moment().subtract(1, 'month')
        break
      case 'Last Year':
        supportActual = moment().subtract(1, 'year')
        break
    }
    switch (packageDate) {
      case 'Last 5 days':
        packageActual = moment().subtract(5, 'days')
        break
      case 'Last Month':
        packageActual = moment().subtract(1, 'month')
        break
      case 'Last Year':
        packageActual = moment().subtract(1, 'year')
        break
    }

    let users = await User.find({ role: 1 }).select('createdAt')
    let packages = await Package.find().select('createdAt status shippedTime')
    let transactions = await Transaction.find({ status: 'Paid' }).select(
      'amount paidAt'
    )
    let tickets, packageTracker
    if (supportActual === null) {
      tickets = await Ticket.find({}).select('status responseTime')
    } else {
      tickets = await Ticket.find({
        createdAt: { $gte: supportActual.toDate() },
      }).select('status responseTime')
    }
    if (packageActual === null) {
      packageTracker = packages
    } else {
      packageTracker = packages.filter(v =>
        moment(v.createdAt).isAfter(packageActual)
      )
    }

    const shippedPackages = packageTracker.filter(v => v.status == 'Shipped')

    res.json({
      status: 'success',
      message: {
        users: {
          total: users.length,
          series: [
            {
              name: 'users',
              data: _.chain(users)
                .groupBy(v => moment(v.createdAt).format('DD'))
                .toPairs()
                .sortBy(v => v[0])
                .map(v => v[1].length)
                .reverse()
                .value(),
            },
          ],
        },
        packages: {
          total: packages.length,
          series: [
            {
              name: 'packages',
              data: _.chain(packages)
                .groupBy(v => moment(v.createdAt).format('DD'))
                .toPairs()
                .sortBy(v => v[0])
                .map(v => v[1].length)
                .reverse()
                .value(),
            },
          ],
        },
        earnings: {
          total: transactions.reduce(
            (ac, curr) => ac + parseInt(curr.amount),
            0
          ),
          series: [
            {
              name: 'earnings',
              data: _.chain(transactions)
                .groupBy(v => moment(v.paidAt).format('DD'))
                .toPairs()
                .sortBy(v => v[0])
                .map(v =>
                  v[1].reduce((ac, curr) => ac + parseInt(curr.amount), 0)
                )
                .reverse()
                .value(),
            },
          ],
        },
        ticketsStats: {
          lastDays: ['Last 5 days', 'Last Month', 'Last Year', 'All time'],
          newTicket: tickets.filter(v => v.status === 'New').length,
          openTicket: tickets.filter(v => v.status === 'In Progress').length,
          responseTime: tickets.reduce(
            (ac, curr) => ac + parseInt(curr.responseTime),
            0
          ),
          supportTrackerRadialBar: {
            series: [
              isNaN(
                Math.round(
                  (tickets.filter(v => v.status !== 'Closed').length /
                    tickets.length) *
                    100
                )
              )
                ? 100
                : Math.round(
                    (tickets.filter(v => v.status !== 'Closed').length /
                      tickets.length) *
                      100
                  ),
            ],
          },
          title: 'Support Tracker',
          totalTicket: tickets.length,
        },
        packageStats: {
          lastDays: ['Last 5 days', 'Last Month', 'Last Year', 'All time'],
          created: packageTracker.filter(v => v.status === 'Recorded').length,
          readyToShip: packageTracker.filter(v => v.status === 'Ready to ship')
            .length,
          shipmentTime:
            shippedPackages.length > 0
              ? parseFloat(
                  shippedPackages.reduce(
                    (ac, curr) => ac + curr.shippedTime,
                    0
                  ) / shippedPackages.length
                ).toFixed(2)
              : 0,
          supportTrackerRadialBar: {
            series: [
              isNaN(
                Math.round((shippedPackages.length / packages.length) * 100)
              )
                ? 100
                : Math.round((shippedPackages.length / packages.length) * 100),
            ],
          },
          title: 'Package Tracker',
          totalPackages: packageTracker.length,
        },
      },
    })
  } catch (err) {
    console.log(err)
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-mainStats',
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
        await Notification.find({}).limit(20).populate('createdBy')
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
      subsystem: 'admin',
      endpoint: 'get-timeline',
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
    var {
      query,
      status,
      page,
      perPage,
      sortBy = 'client',
      sortDesc = 0,
    } = req.query
    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'packageStatus':
        sortObject['status'] = trueSortDesc
        break
      case 'weight':
        sortObject['weight'] = trueSortDesc
        break
      case 'declaredValue':
        sortObject['declaredValue'] = trueSortDesc
        break
      case 'declaredType':
        sortObject['declaredType'] = trueSortDesc
        break
      case 'status':
        sortObject['status'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['status'] = status
    }

    let packages = await Package.find({ ...filterObject })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))
      .populate('user')
      .populate('logistics')
      .populate('warehouse')
      .populate('transaction')
      .populate('deliveryType')
    if (sortBy === 'client') {
      packages.sort((firstEl, secondEl) => {
        if (trueSortDesc === 'asc') {
          return firstEl.user.firstName
            .toString()
            .toLowerCase()
            .localeCompare(secondEl.toString().toLowerCase())
        } else {
          return secondEl.user.firstName
            .toString()
            .toLowerCase()
            .localeCompare(firstEl.toString().toLowerCase())
        }
      })
    } else if (sortBy === 'logistics') {
      packages.sort((firstEl, secondEl) => {
        if (trueSortDesc === 'asc') {
          return firstEl.logistics.firstName
            .toString()
            .toLowerCase()
            .localeCompare(secondEl.toString().toLowerCase())
        } else {
          return secondEl.logistics.firstName
            .toString()
            .toLowerCase()
            .localeCompare(firstEl.toString().toLowerCase())
        }
      })
    } else if (sortBy === 'toWarehouse') {
      packages.sort((firstEl, secondEl) => {
        if (trueSortDesc === 'asc') {
          return firstEl.warehouse.name
            .toString()
            .toLowerCase()
            .localeCompare(secondEl.toString().toLowerCase())
        } else {
          return secondEl.warehouse.name
            .toString()
            .toLowerCase()
            .localeCompare(firstEl.toString().toLowerCase())
        }
      })
    }

    if (query) {
      packages = packages.filter(
        v =>
          v.userID.firstName
            .toString()
            .toLowerCase()
            .search(query.toString().toLowerCase()) > 0
      )
    }

    res.json({
      status: 'success',
      totalItems: await Package.count({ ...filterObject }),
      message: packages.map(v => ({
        id: v._id,
        client: {
          avatar: getFileLink(v.user.avatar),
          name: `${v.user.firstName} ${v.user.lastName}`,
          email: v.user.email,
        },
        logistics: v.logistics
          ? {
              avatar: getFileLink(v.logistics.avatar),
              name: `${v.logistics.firstName} ${v.logistics.lastName}`,
              email: v.logistics.email,
            }
          : undefined,
        fromAddress: v.shippedTo,
        toWarehouse: {
          templateName: v.warehouse.templateName,
          city: v.warehouse.city,
          country: v.warehouse.country,
          state: v.warehouse.state,
          street: v.warehouse.street,
          zipcode: v.warehouse.zipcode,
        },
        invoiceID: v.invoiceID,
        deliveryMode: v.deliveryMode,
        deliveryType:
          v.deliveryMode == 'Delivery'
            ? {
                id: v.deliveryType._id,
                name: v.deliveryType.name,
              }
            : {},
        paidAt: v.transaction?.paidAt,
        weight: v.weight,
        declaredValue: v.declaredValue,
        declaredType: v.declaredType,
        status: v.status,
        shippedAt: v.shippedAt,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-packages',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/users', isAuth, async (req, res) => {
  try {
    var {
      query,
      status,
      page,
      perPage,
      sortBy = 'name',
      sortDesc = 0,
      roleType = 'Logistics',
    } = req.query

    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'userStatus':
        sortObject['enabled'] = trueSortDesc
        break
      case 'name':
        sortObject['firstName'] = trueSortDesc
        break
      case 'email':
        sortObject['email'] = trueSortDesc
        break
      case 'status':
        sortObject['enabled'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['enabled'] = status == 'Enabled' ? true : false
    }
    if (roleType === 'Logistics') {
      filterObject['role'] = 2
    } else {
      filterObject['role'] = 1
    }

    let users = await User.find({ ...filterObject })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))

    if (query) {
      users = users.filter(
        v =>
          v.firstName
            .toString()
            .toLowerCase()
            .search(query.toString().toLowerCase()) > 0
      )
    }

    res.json({
      status: 'success',
      totalItems: await User.count({ ...filterObject }),
      message: users.map(v => ({
        id: v._id,
        name: `${v.firstName} ${v.lastName}`,
        email: v.email,
        status: v.enabled ? 'Enabled' : 'Disabled',
        avatar: getFileLink(v.avatar),
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-users',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})


router.post(
  '/user',
  isAuth,
  uploadAvatar.single('avatar'),
  async (req, res) => {
    try {
      var { firstName, lastName, email, password, phone, countryCode } = req.body
      const user = await User.create({
        firstName,
        lastName,
        email,
        password,
        avatar: req.file ? req.file.key : 'avatar/default-avatar.png',
        countryCode,
        phone,
        role: 2,
      })
      sendWelcomeEmailToUser(user, password)
      res.json({ status: 'success' })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-user',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)


router.get('/user', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const user = await User.findById(id)
    res.json({
      status: 'success',
      message: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        id: user._id,
        avatar: getFileLink(user.avatar),
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-user',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/editUser',
  isAuth,
  uploadAvatar.single('avatar'),
  async (req, res) => {
    try {
      const { id, firstName, lastName, email, phone, countryCode } = req.body
      var user = await User.findById(id)
      if (user) {
        user.firstName = firstName
        user.lastName = lastName
        user.email = email
        user.phone = phone
        user.countryCode = countryCode
        if (req.file) user.avatar = req.file.key
        await user.save()
        res.json({ status: 'success' })
      } else {
        res.json({ status: 'failed', message: 'User not found' })
      }
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-editUser',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/resetPassword', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    const user = await User.findById(id)
    const resetPassToken = uuid()
    if (user) {
      await req.redis.setAsync(
        resetPassToken,
        user._id.toString(),
        'EX',
        60 * 30
      )
      sendResetPasswordByAdmin(
        user.email,
        resetPassToken,
        `${user.firstName} ${user.lastName}`
      )
      res.json({
        status: 'success',
        message: 'Password reset mail sent to the user',
      })
    } else {
      res.json({ status: 'failed', message: 'Email not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-resetPassword',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/enableUser', isAuth, multer().none(), async (req, res) => {
  try {
    var { id } = req.body
    await User.findByIdAndUpdate(id, { enabled: true })
    res.json({ status: 'success', message: 'User enabled' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-enableUser',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/disableUser', isAuth, multer().none(), async (req, res) => {
  try {
    var { id } = req.body
    await User.findByIdAndUpdate(id, { enabled: false })
    res.json({ status: 'success', message: 'User disabled' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-disableUser',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/warehouseSelect', isAuth, async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ active: true }).select(
      '_id templateName'
    )
    res.json({
      status: 'success',
      message: warehouses.map(v => ({
        id: v._id,
        templateName: v.templateName,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-warehouseSelect',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/enablePrice', isAuth, multer().none(), async (req, res) => {
  try {
    var { id } = req.body
    const price = await Price.findById(id)

    if (price) {
      if (
        (await Price.count({
          fromCountry: price.fromCountry,
          toWarehouse: price.toWarehouse,
          priceType: price.priceType,
          active: true,
        })) > 0
      ) {
        res.json({
          status: 'failed',
          message: `A price from ${origin} to this warehouse with ${priceType} already exists`,
        })
        return
      }
      price.active = true
      await price.save()
      res.json({ status: 'success', message: 'Price enabled' })
    } else {
      res.json({ status: 'failed', message: 'No price found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-enablePrices',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/disablePrice', isAuth, multer().none(), async (req, res) => {
  try {
    var { id } = req.body
    await Price.findByIdAndUpdate(id, { active: false })
    res.json({ status: 'success', message: 'Price disabled' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-disablePrices',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/prices', isAuth, async (req, res) => {
  try {
    var {
      status,
      page,
      perPage,
      sortBy = 'country',
      sortDesc = 0,
      priceType,
    } = req.query

    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'priceStatus':
        sortObject['active'] = trueSortDesc
        break
      case 'origin':
        sortObject['fromCountry'] = trueSortDesc
        break
      case 'status':
        sortObject['active'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['active'] = status == 'Enabled' ? true : false
    }
    if (priceType) {
      filterObject['priceType'] = priceType
      if (sortBy === 'price') {
        sortObject['priceValue'] = trueSortDesc
      }
    }

    let prices = await Price.find({ ...filterObject })
      .populate({ path: 'toWarehouse' })
      .populate({ path: 'deliveryType' })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))

    if (sortBy === 'warehouse') {
      prices.sort((firstEl, secondEl) => {
        if (trueSortDesc === 'asc') {
          return firstEl.toWarehouse.templateName
            .toString()
            .toLowerCase()
            .localeCompare(secondEl.toWarehouse.name.toString().toLowerCase())
        } else {
          return secondEl.toWarehouse.templateName
            .toString()
            .toLowerCase()
            .localeCompare(firstEl.toWarehouse.name.toString().toLowerCase())
        }
      })
    }

    res.json({
      status: 'success',
      priceSortable: priceType ? true : false,
      totalItems: await Price.count({ ...filterObject }),
      message: prices.map(v => ({
        id: v._id,
        origin: v.fromCountry,
        warehouse: v.toWarehouse.templateName,
        warehouseAddress: `${v.toWarehouse.street}, ${v.toWarehouse.state}, ${v.toWarehouse.city}, ${v.toWarehouse.zipcode}, ${v.toWarehouse.country}`,
        price: {
          type: v.priceType,
          value: v.priceValue,
        },
        deliveryType: v.deliveryType?.name,
        status: v.active ? 'Enabled' : 'Disabled',
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-prices',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/price', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const price = await Price.findById(id)
      .populate({ path: 'toWarehouse' })
      .populate({ path: 'deliveryType' })
    res.json({
      status: 'success',
      message: {
        origin: price.fromCountry,
        id: price._id,
        warehouse: {
          id: price.toWarehouse._id,
          templateName: price.toWarehouse.templateName,
        },
        price: {
          type: price.priceType,
          value: price.priceValue,
        },
        deliveryType: {
          id: price.deliveryType?._id,
          name: price.deliveryType?.name,
        },
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-price',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/price', isAuth, multer().none(), async (req, res) => {
  try {
    const { origin, warehouse, priceType, price, deliveryType } = req.body

    if (
      (await Price.count({
        fromCountry: origin,
        toWarehouse: warehouse,
        priceType,
        active: true,
        deliveryType,
      })) > 0
    ) {
      res.json({
        status: 'failed',
        message: `A price from ${origin} to this warehouse with ${priceType} already exists`,
      })
      return
    }

    await Price.create({
      fromCountry: origin,
      toWarehouse: warehouse,
      priceType,
      priceValue: price,
      deliveryType,
    })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-price',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/editPrice', isAuth, multer().none(), async (req, res) => {
  try {
    const { id, origin, warehouse, priceType, price, deliveryType } = req.body

    await Price.findByIdAndUpdate(id, {
      fromCountry: origin,
      toWarehouse: warehouse,
      priceType,
      priceValue: price,
      deliveryType,
    })

    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-editPrice',
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
    var {
      query,
      status,
      page,
      perPage,
      sortBy = 'name',
      sortDesc = 0,
    } = req.query

    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'warehouseStatus':
        sortObject['active'] = trueSortDesc
        break
      case 'name':
        sortObject['name'] = trueSortDesc
        break
      case 'templateName':
        sortObject['templateName'] = trueSortDesc
        break
      case 'city':
        sortObject['city'] = trueSortDesc
        break
      case 'country':
        sortObject['country'] = trueSortDesc
        break
      case 'state':
        sortObject['state'] = trueSortDesc
        break
      case 'street':
        sortObject['street'] = trueSortDesc
        break
      case 'zipcode':
        sortObject['zipcode'] = trueSortDesc
        break
      case 'status':
        sortObject['active'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['active'] = status === 'Enabled' ? true : false
    }

    let warehouses = await Warehouse.find({ ...filterObject })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))

    let totalPacks = await Package.find({
      warehouse: { $in: warehouses.map(v => v._id) },
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

    let totalPacksConfigured = _.chain(totalPacks)
      .groupBy(v => v.warehouse)
      .value()

    if (query) {
      warehouses = warehouses.filter(
        v =>
          v.name
            .toString()
            .toLowerCase()
            .search(query.toString().toLowerCase()) > 0
      )
    }

    var warehouseResponse = warehouses.map(v => {
      const totalPacks = totalPacksConfigured[v._id]?.length || 0
      const limitStatusRaw = parseFloat((totalPacks / v.limit) * 100).toFixed(0)
      const limitStatus = isNaN(limitStatusRaw) ? 0 : limitStatusRaw
      return {
        id: v._id,
        name: v.name,
        templateName: v.templateName,
        city: v.city,
        country: v.country,
        state: v.state,
        street: v.street,
        zipcode: v.zipcode,
        status: v.active ? 'Enabled' : 'Disabled',
        limitStatus,
        limit:
          limitStatus < 50
            ? 'green'
            : limitStatus > 50 && limitStatus < 100
            ? 'yellow'
            : 'red',
      }
    })

    if (sortBy === 'limitStatus') {
      if (trueSortDesc === 'asc') {
        warehouseResponse.sort((a, b) => a.limitStatus - b.limitStatus)
      } else {
        warehouseResponse.sort((a, b) => b.limitStatus - a.limitStatus)
      }
    }

    res.json({
      status: 'success',
      totalItems: await Warehouse.count({ ...filterObject }),
      message: warehouseResponse,
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-warehouses',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/enableWarehouse', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    await Warehouse.findByIdAndUpdate(id, { active: true })
    res.json({ status: 'success', message: 'Warehouse enabled' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-enableWarehouse',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/disableWarehouse', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    await Warehouse.findByIdAndUpdate(id, { active: false })
    res.json({ status: 'success', message: 'Warehouse disabled' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-disableWarehouse',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/warehouse',
  isAuth,
  uploadFlag.single('flag'),
  async (req, res) => {
    try {
      const {
        name,
        templateName,
        city,
        country,
        state,
        street,
        zipcode,
        phone,
        limit,
      } = req.body
      await Warehouse.create({
        name,
        templateName,
        city,
        country,
        state,
        street,
        zipcode,
        phone,
        countryFlag: req.file.key,
        limit,
      })
      res.json({ status: 'success' })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-warehouse',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/editWarehouse', isAuth, multer().none(), async (req, res) => {
  try {
    const { id, name, city, country, state, street, zipcode, phone, limit } =
      req.body
    await Warehouse.findByIdAndUpdate(id, {
      name,
      city,
      country,
      state,
      street,
      zipcode,
      phone,
      limit,
    })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-editWarehouse',
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
    res.json({
      status: 'success',
      message: {
        name: warehouse.name,
        templateName: warehouse.templateName,
        city: warehouse.city,
        country: warehouse.country,
        state: warehouse.state,
        street: warehouse.street,
        zipcode: warehouse.zipcode,
        phone: warehouse.phone,
        limit: warehouse.limit,
        id: warehouse._id,
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-warehouse',
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
    const { page, perPage } = req.query

    let tickets = await Ticket.find()
      .populate({ path: 'createdBy' })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))
    res.json({
      status: 'success',
      totalItems: await Ticket.count(),
      message: tickets.map(v => ({
        id: v._id,
        author: {
          id: v.createdBy._id,
          name: `${v.createdBy?.firstName} ${v.createdBy?.lastName}`,
          avatar: v.createdBy.avatar,
        },
        subject: v.subject,
        status: v.status,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
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
      subsystem: 'admin',
      endpoint: 'get-ticket',
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
    const { body, id } = req.body
    const ticket = await Ticket.findById(id)
    if (ticket) {
      ticket.status = 'Awaiting customer response'
      ticket.messageList.push({
        text: body,
        author: req.user._id,
        wroteAt: Date.now(),
      })
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

router.get('/logs', isAuth, async (req, res) => {
  try {
    const { page, perPage } = req.query

    let logs = await ErrLog.find()
      .populate({ path: 'createdBy' })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))
    res.json({
      status: 'success',
      totalItems: await ErrLog.count(),
      message: logs.map(v => ({
        name: v.name,
        subsystem: v.subsystem,
        endpoint: v.endpoint,
        triggeredBy: v.createdBy
          ? `${v.createdBy?.firstName} ${v.createdBy?.lastName}`
          : '',
        message: v.message,
        stack: v.stack,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-logs',
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
        subsystem: 'admin',
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
      subsystem: 'admin',
      endpoint: 'post-settings',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/enableService', isAuth, multer().none(), async (req, res) => {
  try {
    var { id } = req.body
    const service = await Service.findById(id)

    if (service) {
      service.active = true
      await service.save()
      res.json({ status: 'success', message: 'Service enabled' })
    } else {
      res.json({ status: 'failed', message: 'No service found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-enableService',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/disableService', isAuth, multer().none(), async (req, res) => {
  try {
    var { id } = req.body
    await Service.findByIdAndUpdate(id, { active: false })
    res.json({ status: 'success', message: 'Service disabled' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-disableService',
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
    var {
      status,
      page,
      perPage,
      sortBy = 'name',
      sortDesc = 0,
      priceType,
    } = req.query

    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'serviceStatus':
        sortObject['active'] = trueSortDesc
        break
      case 'name':
        sortObject['name'] = trueSortDesc
        break
      case 'required':
        sortObject['required'] = trueSortDesc
        break
      case 'priceType':
        sortObject['priceType'] = trueSortDesc
        break
      case 'status':
        sortObject['active'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['active'] = status == 'Enabled' ? true : false
    }
    if (priceType) {
      filterObject['priceType'] = priceType
      if (sortBy === 'price') {
        sortObject['priceValue'] = trueSortDesc
      }
    }

    let services = await Service.find({ ...filterObject })
      .populate({ path: 'toWarehouse' })
      .populate({ path: 'deliveryType' })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))

    if (sortBy === 'warehouse') {
      services.sort((firstEl, secondEl) => {
        if (trueSortDesc === 'asc') {
          return firstEl.toWarehouse.templateName
            .toString()
            .toLowerCase()
            .localeCompare(secondEl.toWarehouse.name.toString().toLowerCase())
        } else {
          return secondEl.toWarehouse.templateName
            .toString()
            .toLowerCase()
            .localeCompare(firstEl.toWarehouse.name.toString().toLowerCase())
        }
      })
    }

    res.json({
      status: 'success',
      priceSortable: priceType ? true : false,
      totalItems: await Service.count({ ...filterObject }),
      message: services.map(v => ({
        id: v._id,
        name: v.name,
        warehouse: v.toWarehouse.templateName,
        required: v.required ? 'Yes' : 'No',
        priceType: v.priceType,
        price: v.priceValue,
        deliveryMode: v.deliveryMode,
        deliveryType:
          v.deliveryMode == 'Delivery' ? v.deliveryType.name : undefined,
        status: v.active ? 'Enabled' : 'Disabled',
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-services',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/service', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const service = await Service.findById(id)
      .populate({ path: 'toWarehouse' })
      .populate({ path: 'deliveryType' })
    res.json({
      status: 'success',
      message: {
        name: service.name,
        id: service._id,
        warehouse: {
          id: service.toWarehouse._id,
          templateName: service.toWarehouse.templateName,
        },
        price: {
          type: service.priceType,
          value: service.priceValue,
        },
        deliveryMode: service.deliveryMode,
        deliveryType:
          service.deliveryMode == 'Delivery' ? service.deliveryType.name : null,
        declaredType: service.declaredType,
        required: service.required,
      },
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-service',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/service', isAuth, multer().none(), async (req, res) => {
  try {
    const {
      name,
      warehouse,
      priceType,
      price,
      declaredType,
      required,
      deliveryMode,
      deliveryType,
    } = req.body
    const service = await Service.create({
      name,
      toWarehouse: warehouse,
      priceType,
      priceValue: price,
      required,
      deliveryMode,
      deliveryType: deliveryMode == 'Delivery' ? deliveryType : undefined,
    })
    if (priceType === 'Declared Type') {
      service.declaredType = declaredType
      await service.save()
    }
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-service',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/editService', isAuth, multer().none(), async (req, res) => {
  try {
    const {
      id,
      name,
      warehouse,
      priceType,
      price,
      declaredType,
      required,
      deliveryMode,
      deliveryType,
    } = req.body

    const service = await Service.findById(id)
    if (service) {
      service.name = name
      service.toWarehouse = warehouse
      service.priceType = priceType
      if (priceType === 'Declared Type') {
        service.declaredType = declaredType
      }
      service.deliveryMode = deliveryMode
      if (service.deliveryMode == 'Delivery') {
        service.deliveryType = deliveryType
      }
      service.priceValue = price
      service.required = required
      await service.save()
      res.json({ status: 'success' })
    } else {
      res.json({ status: 'failed', message: 'No service found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-editService',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/declaredTypeSelect', isAuth, async (req, res) => {
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
      subsystem: 'admin',
      endpoint: 'get-declaredTypeSelect',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/enableDeclaredType',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id } = req.body
      await DeclaredType.findByIdAndUpdate(id, { active: true })
      res.json({ status: 'success' })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-enableDeclaredType',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post(
  '/disableDeclaredType',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id } = req.body
      await DeclaredType.findByIdAndUpdate(id, { active: false })
      res.json({ status: 'success' })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-disableDeclaredType',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/declaredTypes', isAuth, async (req, res) => {
  try {
    var { status, page, perPage, sortBy = 'name', sortDesc = 0 } = req.query

    let filterObject = {}
    let sortObject = {}
    let trueSortDesc = sortDesc === 0 ? 'asc' : 'desc'
    switch (sortBy) {
      case 'declarationTypeStatus':
        sortObject['status'] = trueSortDesc
        break
      case 'name':
        sortObject['name'] = trueSortDesc
        break
      case 'status':
        sortObject['active'] = trueSortDesc
        break
    }
    if (status) {
      filterObject['active'] = status == 'Enabled' ? true : false
    }

    let declaredTypes = await DeclaredType.find({ ...filterObject })
      .sort({ ...sortObject })
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))

    res.json({
      status: 'success',
      totalItems: await DeclaredType.count({ ...filterObject }),
      message: declaredTypes.map(v => ({
        id: v._id,
        name: v.name,
        subTypes: v.subTypes,
        status: v.active ? 'Enabled' : 'Disabled',
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-getDeclaredTypes',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/declaredType', isAuth, multer().none(), async (req, res) => {
  try {
    const { name, subTypes } = req.body
    if (!subTypes || !subTypes.length) {
      res.json({ status: 'failed', message: 'At least 1 subtype required' })
      return
    }
    await DeclaredType.create({
      name,
      subTypes,
    })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-declaredType',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/editDeclaredType', isAuth, multer().none(), async (req, res) => {
  try {
    const { id, name, subTypes } = req.body
    await DeclaredType.findByIdAndUpdate(id, { name, subTypes })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-editDeclaredType',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/declaredType', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const decType = await DeclaredType.findById(id)
    if (decType) {
      res.json({
        status: 'success',
        message: {
          id: decType._id,
          name: decType.name,
          subTypes: decType.subTypes,
        },
      })
    } else {
      res.json({ status: 'failed', message: 'DeclaredType not found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-declaredType',
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

    invoice.dataIssued = moment(invoice.dataIssued).format('YYYY-MM-DD')
    invoice.total = parseFloat(invoice.total).toFixed(2)

    res.json({ status: 'success', message: invoice })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-declaredType',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/enablePickup', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    await Pickup.findByIdAndUpdate(id, { active: true })
    res.json({ status: 'success', message: 'Pickup enabled successfully' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-enablePickup',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/disablePickup', isAuth, multer().none(), async (req, res) => {
  try {
    const { id } = req.body
    await Pickup.findByIdAndUpdate(id, { active: false })
    res.json({ status: 'success', message: 'Pickup disabled successfully' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-disablePickup',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/pickups', isAuth, async (req, res) => {
  try {
    const { page, perPage } = req.query

    let pickups = await Pickup.find()
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))
    res.json({
      status: 'success',
      totalItems: await Pickup.count(),
      message: pickups.map(v => ({
        id: v._id,
        name: v.name,
        address: {
          street: v.street,
          state: v.state,
          city: v.city,
          country: v.country,
          zipcode: v.zipcode,
        },
        status: v.active ? 'Enabled' : 'Disabled',
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-pickups',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/pickup', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const pickup = await Pickup.findById(id)
    if (pickup) {
      res.json({
        status: 'success',
        message: {
          id: pickup._id,
          name: pickup.name,
          street: pickup.street,
          state: pickup.state,
          country: pickup.country,
          city: pickup.city,
          zipcode: pickup.zipcode,
        },
      })
    } else {
      res.json({ status: 'failed', message: 'No pickup found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-pickup',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/pickup', isAuth, multer().none(), async (req, res) => {
  try {
    const { name, city, country, state, street, zipcode } = req.body

    await Pickup.create({
      name,
      city,
      country,
      state,
      street,
      zipcode,
    })

    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-pickup',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/editPickup', isAuth, multer().none(), async (req, res) => {
  try {
    const { id, name, city, country, state, street, zipcode } = req.body
    await Pickup.findByIdAndUpdate(id, {
      name,
      city,
      country,
      state,
      street,
      zipcode,
    })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-editPickup',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post(
  '/enableDeliveryType',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id } = req.body
      await DeliveryType.findByIdAndUpdate(id, { active: true })
      res.json({
        status: 'success',
        message: 'Delivery type enabled successfully',
      })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-enableDeliveryType',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post(
  '/disableDeliveryType',
  isAuth,
  multer().none(),
  async (req, res) => {
    try {
      const { id } = req.body
      await DeliveryType.findByIdAndUpdate(id, { active: false })
      res.json({
        status: 'success',
        message: 'Delivery type disabled successfully',
      })
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'admin',
        endpoint: 'post-disableDeliveryType',
        stack: err.stack,
        createdBy: req.user?._id,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/deliveryTypes', isAuth, async (req, res) => {
  try {
    const { page, perPage } = req.query

    let deliveryTypes = await DeliveryType.find()
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage))
    res.json({
      status: 'success',
      totalItems: await DeliveryType.count(),
      message: deliveryTypes.map(v => ({
        id: v._id,
        name: v.name,
        status: v.active ? 'Enabled' : 'Disabled',
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-deliveryTypes',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/editDeliveryType', isAuth, multer().none(), async (req, res) => {
  try {
    const { id, name } = req.body
    await DeliveryType.findByIdAndUpdate(id, { name })
    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-editDeliveryType',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})
router.get('/deliveryType', isAuth, async (req, res) => {
  try {
    const { id } = req.query
    const deliveryType = await DeliveryType.findById(id)
    if (deliveryType) {
      res.json({
        status: 'success',
        message: {
          id: deliveryType._id,
          name: deliveryType.name,
        },
      })
    } else {
      res.json({ status: 'failed', message: 'No pickup found' })
    }
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-deliveryType',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/deliveryType', isAuth, multer().none(), async (req, res) => {
  try {
    const { name } = req.body

    await DeliveryType.create({
      name,
    })

    res.json({ status: 'success' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-deliveryType',
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
      subsystem: 'admin',
      endpoint: 'get-deliveryTypeSelect',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/websiteSettings', isAuth, async (req, res) => {
  try {
    res.json({
      status: 'success',
      message: (await Settings.find({})).map(v => ({
        id: v._id,
        name: v.name,
        value: v.value,
        label: v.label,
      })),
    })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'get-websiteSettings',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.post('/websiteSettings', isAuth, multer().none(), async (req, res) => {
  try {
    const { settingsObject } = req.body
    const settings = JSON.parse(settingsObject)
    for (var i = 0; i < settings.length; i++) {
      if (settings[i].id) {
        await Settings.findByIdAndUpdate(settings[i].id, {
          value: settings[i].value,
        })
      }
    }
    res.json({ status: 'success', message: 'Settings updated successfully' })
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-websiteSettings',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

router.get('/exportShipments', isAuth, multer().none(), async (req, res) => {
  try {
    const { exportType } = req.query
    let filterObj = {
      status: 'Paid',
    }
    if (exportType == 1) {
      filterObj['isExported'] = false
    }
    const packages = await Package.find(filterObj)
      .populate('user')
      .populate('warehouse')
      .populate('pickupLocation')
      .populate('deliveryType')
      .populate('shipment')
    if (!packages.length) {
      res.send("No package found")
      return
    }
    const packageAddress = pckg => {
      if (pckg.deliveryMode == 'Delivery') {
        return `${pckg.shippedTo.street}, ${pckg.shippedTo.city}, ${pckg.shippedTo.state}, ${pckg.shippedTo.country}, ${pckg.shippedTo.zipcode}`
      } else {
        return `${pckg.pickupLocation.street}, ${pckg.pickupLocation.city}, ${pckg.pickupLocation.state}, ${pckg.pickupLocation.country}, ${pckg.pickupLocation.zipcode}`
      }
    }
    const excelJson = packages.map(v => ({
      'Tracking Number': v.trackingNumber,
      Customer: `${v.user.firstName} ${v.user.lastName}`,
      Warehouse: v.warehouse.templateName,
      'Delivery Type': v.deliveryMode,
      'Delivery Method': v.deliveryMode == 'Delivery' ? v.deliveryType : null,
      'Location Delivery/Pickup': packageAddress(v),
      Weight: v.weight,
      'Declared Type': v.declaredType,
      'Declared Value': `$${v.declaredValue}`,
    }))
    const excel = generateExcelReport(excelJson)
    for (var i = 0; i < packages.length; i++) {
      if (!packages[i].isExported) {
        packages[i].isExported = true
        await packages[i].save()
      }
    }
    const stream = Readable.from(excel)
    res.header('Content-Disposition', 'attachment; filename="exportReport.csv"')
    stream.pipe(res)
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      subsystem: 'admin',
      endpoint: 'post-exportShipments',
      stack: err.stack,
      createdBy: req.user?._id,
    }).catch(err2 => {
      console.log(err2)
    })
    res.json({ status: 'failed', message: 'Server error' })
  }
})

module.exports = router
