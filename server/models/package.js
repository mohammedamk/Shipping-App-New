const mongoose = require('mongoose')

const packages = new mongoose.Schema(
  {
    shippedTo: {
      city: String,
      country: String,
      state: String,
      street: String,
      zipcode: String,
      name: String,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    logistics: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    weight: Number,
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    declaredValue: Number,
    declaredType: String,
    extraServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Services' }],
    confirmedServices: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Services' },
    ],
    trackingNumber: String,
    deliveryMode: {
      type: String,
      enum: ['Pickup', 'Delivery'],
    },
    invoiceID: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    deliveryType: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryType' },
    flatRate: Number,
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
    packageArrivedAt: Date,
    pickupLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Pickup' },
    logisticsCost: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'Pre-Booked',
        'Recorded',
        'Arrived at warehouse',
        'Awaiting user actions',
        'Unpaid',
        'Paid',
        'Ready to ship',
        'Out for delivery',
        'Shipped',
        'Ready to pickup',
        'Picked up',
        'Awaiting return',
        'Returned',
      ],
      default: 'Recorded',
    }, // Recorded, Awaiting user actions, Unpaid, Paid, Ready to ship, Shipped, Awaiting return, Returned
    createdAt: { type: Date, required: true, default: () => Date.now() },
    isExported: { type: Boolean, default: false },
    shippedTime: Number,
    readyToShipAt: Date,
    outForDeliveryAt: Date,
    shippedAt: Date,
    pickedupAt: Date,
    paidAt: Date
  },
  {
    collection: 'packages',
  }
)

module.exports = mongoose.model('Package', packages)
