const mongoose = require('mongoose')

const tickets = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subject: String,
    messageList: [
      {
        text: String,
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        wroteAt: { type: Date },
      },
    ],
    status: {
      type: String,
      enum: [
        'Created',
        'Awaiting customer response',
        'Awaiting support response',
        'Closed',
      ],
      default: 'Created',
    }, //Created, Awaiting customer response, Awaiting support response, Closed
    createdAt: { type: Date, required: true, default: () => Date.now() },
    solvedAt: Date,
  },
  {
    collection: 'tickets',
  }
)

module.exports = mongoose.model('Ticket', tickets)
