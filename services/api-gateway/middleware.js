// The gateway now holds no database, so ownership/authorship checks moved into the
// owning services (listing-service / review-service). The gateway only gates access to
// authenticated routes; identity is populated onto req.user from the JWT in app.js.
module.exports.isLoggedin = (req, res, next) => {
    if (!req.user) {
        // Remember where the user was headed so we can return them there after login.
        // Stored in a short-lived cookie instead of a server session.
        if (req.method === "GET") {
            res.cookie("redirectUrl", req.originalUrl, { httpOnly: true, maxAge: 5 * 60 * 1000 });
        } else if (req.headers.referer) {
            try {
                const url = new URL(req.headers.referer);
                res.cookie("redirectUrl", url.pathname, { httpOnly: true, maxAge: 5 * 60 * 1000 });
            } catch (e) {
                // ignore malformed referer
            }
        }
        req.flash("error", "You must be signed in");
        return res.redirect("/login");
    }
    next();
};
