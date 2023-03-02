const mongoose = require('mongoose')

const pickup = new mongoose.Schema({
    name: String,
    city: String,
    country: String,
    state: String,
    street: String,
    zipcode: String,
    active: {type: Boolean, default: true},
    createdAt: { type: Date, required: true, default: () => Date.now() },
}, {
    collection: 'pickups'
})

module.exports = mongoose.model('Pickup', pickup)