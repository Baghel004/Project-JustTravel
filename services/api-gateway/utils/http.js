// Service locations + identity forwarding. The gateway verifies the JWT (app.js) and
// forwards the caller's identity to internal services as trusted headers.
const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:4002';
const REVIEW_SERVICE_URL = process.env.REVIEW_SERVICE_URL || 'http://localhost:4003';

function identityHeaders(req) {
    const headers = {};
    if (req.user) {
        headers['X-User-Id'] = req.user._id;
        headers['X-User-Name'] = req.user.username;
    }
    return headers;
}

module.exports = { LISTING_SERVICE_URL, REVIEW_SERVICE_URL, identityHeaders };
