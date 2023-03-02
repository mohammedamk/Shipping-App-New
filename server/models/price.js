const mongoose = require('mongoose')

const price = new mongoose.Schema(
  {
    fromCountry: String,
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    priceType: {
      type: String,
      enum: ['Flat rate', 'Per kg'],
      default: 'Flat rate'
    },
    priceValue: Number,
    deliveryType: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryType' },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'prices',
  }
)

module.exports = mongoose.model('Price', price)
