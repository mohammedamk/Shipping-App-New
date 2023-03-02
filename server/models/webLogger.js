const mongoose = require('mongoose')

var log = new mongoose.Schema(
  {
    message: { type: String, required: true },
    name: { type: String, required: true },
    subsystem: { type: String },
    endpoint: { type: String },
    stack: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'logs',
  }
)

module.exports = mongoose.model('Log', log)
