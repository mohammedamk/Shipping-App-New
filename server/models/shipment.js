const mongoose = require('mongoose')

const shipment = new mongoose.Schema(
  {
    jobID: String,
    shipmentUniqueID: {
      type: String,
      default: () =>
        (Math.floor(Math.random() * (1000000 - 1 + 1)) + 1).toString(),
    },
    packageIDs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Package' }],
    transactionID: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    invoiceID: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['Created', 'Started', 'Successful'],
      default: 'Created',
    },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    createdAt: { type: Date, required: true, default: () => Date.now() },
    deliveryMode: { type: String, enum: ['Delivery', 'Pickup'] },
  },
  {
    collection: 'shipments',
  }
)

module.exports = mongoose.model('Shipment', shipment)
