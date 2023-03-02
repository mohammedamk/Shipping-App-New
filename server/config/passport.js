const localStrategy = require('passport-local').Strategy

const User = require('./../models/user')

const bcrypt = require('bcrypt')

const {getFileLink} = require('./../helpers/getCFLink')


function initialize(passport) {
    const authenticateUser = (email, password, done) => {
        User.findOne({email, role: {$ne: 2}}).exec().then(user => {
            if(user == null) return done(null, false, {message: "Wrong username or password"})
            else {
                try {
                    if (bcrypt.compareSync(password, user.password)) {
                        if (!user.enabled) {
                            return done(null, false, {message: 'User is disabled!'})
                        }
                        user.password = undefined;
                        user.avatar = getFileLink(user.avatar)
                        return done(null, user)
                    }
                    else
                    {
                        return done(null, false, {message: "Wrong username or password"})
                    }
                } catch (e) {
                    return done(e)
                }
            }   
        }).catch(err=>{return done(err)})
    }

    passport.use(new localStrategy({usernameField: 'email'}, authenticateUser))
    passport.serializeUser((user, done) => done(null, user._doc._id))
    passport.deserializeUser((id, done) => {
        User.findById(id).exec().then(user => {
            if(user && user.enabled)
            {
                user.password = undefined;
                user.avatar = getFileLink(user.avatar)
                return done(null, user)
            }
            else
            {
                return done(null, false)
            }
        }).catch(err => done(err))
    })
}

module.exports = initialize