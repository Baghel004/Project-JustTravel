const { reviewSch } = require('./schema.js');

// Identity forwarded by the gateway (which verified the JWT). Internal-only service.
module.exports.requireIdentity = (req, res, next) => {
    const userId = req.header('X-User-Id');
    const username = req.header('X-User-Name');
    if (!userId) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    req.identity = { userId, username };
    next();
};

module.exports.validateReview = (req, res, next) => {
    const result = reviewSch.validate(req.body.review || {});
    if (result.error) {
        const errMsg = result.error.details.map((el) => el.message).join(',');
        return res.status(400).json({ error: errMsg });
    }
    next();
};
