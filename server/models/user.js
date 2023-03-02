const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

var user = mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    password: String,
    role: {
      type: Number,
      min: 0,
      max: 2,
      default: 1,
    }, //0 -> Admin, 1 -> User, 2 -> Logistics
    countryCode: String,
    phone: String,
    notificationType: String,
    profileID: String,
    avatar: String,
    street: String,
    city: String,
    state: String,
    country: String,
    zipcode: String,
    uID: {
      type: String,
      default: () =>
        (Math.floor(Math.random() * (1000000 - 1 + 1)) + 1).toString(),
    },
    enabled: { type: Boolean, default: true },
    createdAt: { type: Date, required: true, default: () => Date.now() },
  },
  {
    collection: 'Users',
  }
)

user.pre('save', function (next) {
  if (this.isModified('password'))
    this.password = bcrypt.hashSync(this.password, 10)
  next()
})

module.exports = mongoose.model('User', user)
