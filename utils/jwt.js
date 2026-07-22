const jwt = require('jsonwebtoken');

// In the microservices split, this same secret is shared with the API gateway so
// it can verify tokens issued here by the user-service. Keep it in env only.
const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const EXPIRES_IN = '7d';

// Name of the httpOnly cookie that carries the token (so the EJS frontend keeps
// working without any client-side token handling).
const COOKIE = 'token';

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function signToken(user) {
    return jwt.sign(
        { sub: user._id.toString(), username: user.username },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

function verifyToken(token) {
    return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken, COOKIE, cookieOptions };
