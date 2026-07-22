const jwt = require('jsonwebtoken');

// The user-service is the ONLY service that issues (signs) tokens. The gateway shares
// this JWT_SECRET but only ever verifies. Keep it in env in both places.
const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const EXPIRES_IN = '7d';

function signToken(user) {
    return jwt.sign(
        { sub: user._id.toString(), username: user.username },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

module.exports = { signToken };
