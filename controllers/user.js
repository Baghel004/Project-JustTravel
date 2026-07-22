const User = require('../models/user');
const { signToken, COOKIE, cookieOptions } = require('../utils/jwt');

module.exports.doSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email });
        // passport-local-mongoose still handles password hashing/salting.
        const registeredUser = await User.register(newUser, password);
        // Issue a JWT and drop it in an httpOnly cookie instead of establishing a session.
        res.cookie(COOKIE, signToken(registeredUser), cookieOptions);
        req.flash("success", "Welcome to Wanderlust");
        res.redirect("/listings");
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
};

// Replaces passport.authenticate("local"). Verifies credentials via the
// passport-local-mongoose static (no passport session), then issues a JWT.
module.exports.login = (req, res, next) => {
    const { username, password } = req.body;
    User.authenticate()(username, password, (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash("error", (info && info.message) || "Invalid username or password");
            return res.redirect("/login");
        }
        res.cookie(COOKIE, signToken(user), cookieOptions);
        req.flash("success", "Welcome back to Wanderlust");
        const redirectUrl = req.cookies.redirectUrl || "/listings";
        res.clearCookie("redirectUrl");
        res.redirect(redirectUrl);
    });
};

module.exports.doLogout = (req, res) => {
    res.clearCookie(COOKIE);
    req.flash("success", "logged out successfully");
    res.redirect('/listings');
};

module.exports.showSignup = (req, res) => {
    res.render("users/signup.ejs", { signupCss: true });
};

module.exports.showLogin = (req, res) => {
    res.render("users/login.ejs", { signupCss: true });
};
