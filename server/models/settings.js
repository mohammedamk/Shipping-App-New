const mongoose = require('mongoose')

const settings = new mongoose.Schema(
  {
    name: String,
    value: String,
    label: String,
  },
  {
    collection: 'settings',
  }
)

module.exports = mongoose.model('Setting', settings)
