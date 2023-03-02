const { Price, Service, Package, Settings } = require('../models')

const _ = require('lodash')

async function calculatePrice(package, weight) {
  if (package.deliveryMode == 'Pickup') {
    return { status: 'success', message: 0 }
  }
  const prices = await Price.find({
    fromCountry: package.shippedTo.country,
    toWarehouse: package.warehouse._id,
    deliveryType: package.deliveryType,
    active: true,
  })
  let flatRate = 0
  if (prices.length) {
    let totalCost = 0
    prices.forEach(v => {
      if (v.priceType == 'Per kg') {
        totalCost += v.priceValue * weight
      } else if (v.priceType == 'Flat rate') {
        totalCost += v.priceValue
        flatRate = v.priceValue
      }
    })
    return {
      status: 'success',
      message: {
        total: totalCost,
        flatRate,
      },
    }
  } else {
    return {
      status: 'failed',
      message: "There' no price for the customer's country",
    }
  }
}

async function calculateTotalCostWithDiscount(cartData) {
  //id -> package ID
  //services -> serviceIDs
  //declaredValue -> for individual packages
  const packageSettings = await Settings.find({
    name: { $in: ['freeDeposit', 'costPerKgDeposit'] },
  })
  const settings = {
    freeDeposit: packageSettings.find(v => v.name == 'freeDeposit')['value'],
    costPerKgDeposit: packageSettings.find(v => v.name == 'costPerKgDeposit')[
      'value'
    ],
  }
  const moment = require('moment')
  let subtotal = 0
  let discount = await calculateDiscount(cartData.map(v => v.id))
  let invoiceLines = []
  for (var i = 0; i < cartData.length; i++) {
    let package = await Package.findById(cartData[i]['id']).select(
      'logisticsCost weight trackingNumber packageArrivedAt'
    )
    if (package) {
      subtotal += package.logisticsCost
      invoiceLines.push({
        name: `Package #${package.trackingNumber}`,
        weight: package.weight,
        cost: package.logisticsCost,
      })
      const packagePaidStoredDays =
        moment().diff(moment(package.packageArrivedAt), 'days') -
        settings.freeDeposit
      if (packagePaidStoredDays > 0) {
        const packageStoredCost =
          settings.costPerKgDeposit * package.weight * packagePaidStoredDays
        subtotal += packageStoredCost
        invoiceLines.push({
          name: `Storage fee: ${packagePaidStoredDays} days`,
          cost: packageStoredCost,
        })
      }
    }
    let services = await Service.find({
      _id: { $in: cartData[i]['services'] },
    }).select('priceType priceValue name')
    if (services.length) {
      for (var x = 0; x < services.length; x++) {
        let serviceLine = {
          name: services[x].name,
        }
        switch (services[x].priceType) {
          case 'Flat rate':
            subtotal += services[x].priceValue
            serviceLine['cost'] = services[x].priceValue
            break
          case 'Declared Value':
            subtotal +=
              cartData[i].declaredValue * (services[x].priceValue / 100)
            serviceLine['cost'] =
              cartData[i].declaredValue * (services[x].priceValue / 100)
            break
          case 'Declared Type':
            subtotal += services[x].priceValue
            serviceLine['cost'] = services[x].priceValue
            break
          case 'Weight':
            subtotal += services[x].priceValue * package.weight
            serviceLine['cost'] = services[x].priceValue * package.weight
            break
        }
        invoiceLines.push(serviceLine)
      }
    }
  }

  return {
    subtotal,
    discount,
    total: subtotal - discount,
    invoiceLines,
  }
}

function formatAddress(address) {
  return `${address.name},${address.street},${address.state},${address.city}, ${address.zipcode},${address.country}`
}

async function calculateDiscount(packageIDs) {
  return _.chain(
    await Package.find({
      _id: { $in: packageIDs },
      deliveryMode: 'Delivery',
    }).select('deliveryType shippedTo flatRate warehouse')
  )
    .map(v => ({
      deliveryType: `${v.deliveryType}|${formatAddress(v.shippedTo)}|${
        v.warehouse
      }`,
      flatRate: v.flatRate,
    }))
    .groupBy(v => v.deliveryType)
    .toPairs()
    .map(v => ({
      amount: v[1][0].flatRate ?? 0,
      length: v[1].length,
    }))
    .value()
    .reduce((a, b) => a + b.amount * (b.length - 1), 0)
}

async function bundlePackagesToShipment(packageIDs) {
  const packages = await Package.find({
    _id: { $in: packageIDs },
  }).select('_id deliveryType shippedTo deliveryMode warehouse')
  const deliveryBundler = _.chain(packages)
    .filter(v => v.deliveryMode == 'Delivery')
    .map(v => ({
      deliveryType: `${v.deliveryType}|${formatAddress(v.shippedTo)}|${
        v.warehouse
      }`,
      id: v._id,
      warehouse: v.warehouse,
    }))
    .groupBy(v => v.deliveryType)
    .toPairs()
    .map(v =>
      v[1].map(t => ({
        id: t.id,
        warehouse: t.warehouse,
        deliveryMode: 'Delivery'
      }))
    )
    .value()
  return [
    ...deliveryBundler,
    ...packages
      .filter(v => v.deliveryMode == 'Pickup')
      .map(v => [
        {
          id: v._id,
          warehouse: v.warehouse,
          deliveryMode: 'Pickup'
        },
      ]),
  ]
}

module.exports = {
  calculatePrice,
  calculateTotalCostWithDiscount,
  bundlePackagesToShipment,
}
