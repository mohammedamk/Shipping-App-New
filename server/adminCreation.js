const mongoose = require('mongoose')

require('dotenv').config()

mongoose.connect(process.env.MONGO_CON_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
})
  ; (async () => {
    try {
      const { User, Settings } = require('./models')

      const result = await User.find({ role: 0 })

      if (!result.length) {
        const r = await User.create({
          firstName: 'admin',
          lastName: 'admin',
          email: 'admin@admin.com',
          password: 'admin',
          phone: '02838484',
          role: 0,
          avatar: 'avatar/default-avatar.png',
        })
        console.log(`${r.email} has been created successfully`)
      } else {
        console.log('Admin user already exists')
      }

      const settings = await Settings.find({})

      const settingsList = [
        { name: 'freeDeposit', value: 10, label: "Free deposit days" },
        { name: 'costPerKgDeposit', value: 10, label: "Deposit cost/kg" }
      ]

      if (settings.length) {
        for (var i = 0; i < settingsList.length; i++) {
          if (!settings.map(v => v.name).includes(settingsList[i].name)) {
            await Settings.create({
              name: settingsList[i].name,
              value: settingsList[i].value,
              label: settingsList[i].label,
            })
            console.log(`${settingsList[i].name} initialized!`)
          }
        }
      } else {
        for (var i = 0; i < settingsList.length; i++) {
          await Settings.create({
            name: settingsList[i].name,
            value: settingsList[i].value,
            label: settingsList[i].label,
          })
          console.log(`${settingsList[i].name} initialized!`)
        }
      }

      process.exit(01)
    } catch (err) {
      console.log(err)
      process.exit(04)
    }
  })()
