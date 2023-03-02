const mongoose = require('mongoose')

const declaredType = new mongoose.Schema(
  {
    name: String,
    subTypes: Array,
    active: {type: Boolean, default: true},
    createdAt: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'declaredTypes',
  }
)

module.exports = mongoose.model('DeclaredType', declaredType)
