const mongoose = require('mongoose')

var transactions = new mongoose.Schema(
  {
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    status: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' }, //Unpaid, Paid,
    paidAt: Date,
  },
  {
    collection: 'transactions',
  }
)

module.exports = mongoose.model('Transaction', transactions)
