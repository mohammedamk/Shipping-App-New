const mongoose = require('mongoose')

const counter = require('./counterSchema')

const invoice = new mongoose.Schema(
  {
    customer: {
      name: String,
      address: String,
      address2: String,
      email: String,
    },
    invoiceNr: Number,
    itemList: [
      {
        name: String,
        weight: Number,
        cost: Number,
      },
    ],
    totalWithoutDiscount: Number,
    discount: Number,
    dataIssued: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'invoices',
  }
)

invoice.pre('save', function (next) {
  var doc = this
  counter.findOneAndUpdate(
    { name: 'invoice' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
    function (error, counter) {
      if (error) return next(error)
      doc.invoiceNr = counter.seq
      next()
    }
  )
})

module.exports = mongoose.model('Invoice', invoice)
