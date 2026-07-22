const User = require('../models/user');
const { signToken } = require('../utils/jwt');

// POST /auth/signup -> create user, return a signed JWT
module.exports.signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'username, email and password are required' });
        }
        const user = new User({ username, email });
        // passport-local-mongoose handles hashing/salting.
        const registered = await User.register(user, password);
        const token = signToken(registered);
        res.status(201).json({
            token,
            user: { id: registered._id, username: registered.username },
        });
    } catch (err) {
        // e.g. duplicate username -> surface a 400 with the message
        res.status(400).json({ error: err.message });
    }
};

// POST /auth/login -> verify credentials, return a signed JWT
module.exports.login = (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }
    User.authenticate()(username, password, (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(401).json({ error: (info && info.message) || 'Invalid username or password' });
        }
        const token = signToken(user);
        res.json({ token, user: { id: user._id, username: user.username } });
    });
};

// POST /users/batch -> resolve [id] to [{id, username}]. Fallback for any place the
// denormalized username is missing; keeps the gateway from doing per-item lookups.
module.exports.batch = async (req, res, next) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
        const users = await User.find({ _id: { $in: ids } }, 'username');
        res.json(users.map((u) => ({ id: u._id, username: u.username })));
    } catch (err) {
        next(err);
    }
};
