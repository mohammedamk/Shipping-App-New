const jwt = require('jsonwebtoken')

function tokenDriver(req, _res, next) {
    try {
        const authHeader = req.get('Authorization')
        if (!authHeader) {
            req.logisticsID = undefined;
            return next()
        }

        const token = authHeader.split(' ')[1];

        if (!token || token === '') {
            req.logisticsID = undefined;
            return next()
        }

        let decodedToken = jwt.verify(token, 'KaizenJBqPnEOtMcShippingLogistics')

        req.logisticsID = decodedToken.logisticsID;

        return next();

    } catch (err) {
        req.logisticsID = undefined;
        return next()
    }
}

module.exports = tokenDriver;