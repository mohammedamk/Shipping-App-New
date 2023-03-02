const mongoose = require('mongoose')

var notifications = new mongoose.Schema({
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    title: String,
    body: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    createdAt: { type: Date, required: true, default: () => Date.now() },
}, {
    collection: 'notifications'
})

module.exports = mongoose.model('Notification', notifications);