const jwt = require('jsonwebtoken');

// The gateway only VERIFIES tokens — the user-service is the sole issuer. Both share
// this JWT_SECRET via env.
const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

// Name of the httpOnly cookie that carries the token (so the EJS frontend keeps
// working without any client-side token handling).
const COOKIE = 'token';

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function verifyToken(token) {
    return jwt.verify(token, SECRET);
}

module.exports = { verifyToken, COOKIE, cookieOptions };
