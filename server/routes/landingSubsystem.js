const router = require('express').Router()
const multer = require('multer')
const { User, ErrLog } = require('../models')

function isAuth(req, res, next) {
    if (req.user && req.user?.role == 0) next()
    else res.json({ status: 'failed', message: 'Invalid role', unauthorized: 1 })
  }

router.get('/minCost', async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'get-minCost',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/featuredBrands', async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'get-featuredBrands',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/featuredBrand', isAuth, async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'post-featuredBrands',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/serviceList', async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'get-serviceList',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/service', multer().none(), isAuth, async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'post-service',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/serviceMockup', async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'get-serviceMockup',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/rates_fees', async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'get-rates_fees',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/rates_fees', isAuth, async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'post-rates_fees',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.get('/faq', async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'get-faq',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

router.post('/faq', isAuth, async (req, res) => {
    try {
      
    } catch (err) {
      ErrLog.create({
        message: err.message,
        name: err.name,
        subsystem: 'landing',
        endpoint: 'post-faq',
        stack: err.stack,
      }).catch(err2 => {
        console.log(err2)
      })
      res.json({ status: 'failed', message: 'Server error' })
    }
  }
)

module.exports = router
