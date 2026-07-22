const { listingSchema } = require('./schema.js');

// Identity is established by the gateway (which verifies the JWT) and forwarded as
// trusted headers. Domain services are internal-only, so they trust these headers.
module.exports.requireIdentity = (req, res, next) => {
    const userId = req.header('X-User-Id');
    const username = req.header('X-User-Name');
    if (!userId) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    req.identity = { userId, username };
    next();
};

module.exports.validateListing = (req, res, next) => {
    const result = listingSchema.validate(req.body);
    if (result.error) {
        const errMsg = result.error.details.map((el) => el.message).join(',');
        return res.status(400).json({ error: errMsg });
    }
    next();
};
