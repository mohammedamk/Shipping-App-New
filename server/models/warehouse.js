const mongoose = require('mongoose')

const warehouse = new mongoose.Schema(
  {
    name: String,
    templateName: String,
    city: String,
    country: String,
    state: String,
    street: String,
    zipcode: String,
    countryFlag: String,
    phone: String,
    limit: Number,
    active: {type: Boolean, default: true},
    createdAt: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'warehouses',
  }
)

module.exports = mongoose.model('Warehouse', warehouse)
