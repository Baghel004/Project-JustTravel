// The gateway no longer does auth itself — it proxies signup/login to the user-service
// and manages the browser's JWT cookie. View rendering (login/signup pages) stays here
// because the gateway owns the frontend.
const { COOKIE, cookieOptions } = require('../utils/jwt');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:4001';

module.exports.showSignup = (req, res) => {
    res.render("users/signup.ejs", { signupCss: true });
};

module.exports.showLogin = (req, res) => {
    res.render("users/login.ejs", { signupCss: true });
};

module.exports.doSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const response = await fetch(`${USER_SERVICE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            req.flash("error", data.error || "Signup failed");
            return res.redirect("/signup");
        }
        res.cookie(COOKIE, data.token, cookieOptions);
        req.flash("success", "Welcome to Wanderlust");
        res.redirect("/listings");
    } catch (err) {
        req.flash("error", "Signup service is unavailable, please try again");
        res.redirect("/signup");
    }
};

module.exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const response = await fetch(`${USER_SERVICE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            req.flash("error", data.error || "Invalid username or password");
            return res.redirect("/login");
        }
        res.cookie(COOKIE, data.token, cookieOptions);
        req.flash("success", "Welcome back to Wanderlust");
        const redirectUrl = req.cookies.redirectUrl || "/listings";
        res.clearCookie("redirectUrl");
        res.redirect(redirectUrl);
    } catch (err) {
        req.flash("error", "Login service is unavailable, please try again");
        res.redirect("/login");
    }
};

module.exports.doLogout = (req, res) => {
    res.clearCookie(COOKIE);
    req.flash("success", "logged out successfully");
    res.redirect('/listings');
};
