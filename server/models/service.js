const mongoose = require('mongoose')

const service = new mongoose.Schema(
  {
    name: String,
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    priceType: {
      type: String,
      enum: ['Flat rate', 'Declared Value', 'Declared Type', 'Weight'],
      default: 'Flat rate',
    },
    declaredType: { type: String, required: false },
    priceValue: Number,
    deliveryMode: {
      type: String, enum: ['Pickup', 'Delivery']
    },
    deliveryType: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryType' },
    required: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'services',
  }
)

module.exports = mongoose.model('Services', service)
