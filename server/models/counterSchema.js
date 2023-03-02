const mongoose = require('mongoose')

const counter = new mongoose.Schema({
    name: String,
    seq: {type: Number, default: 1}
}, {
    collection: 'counters'
})

module.exports = mongoose.model('Counter', counter)