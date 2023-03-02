const mongoose = require('mongoose')

const deliveryType = new mongoose.Schema({
    name: String,
    active: {type: Boolean, default: true},
    createdAt: { type: Date, required: true, default: () => Date.now() },
}, {
    collection: 'deliveryTypes'
})

module.exports = mongoose.model('DeliveryType', deliveryType)