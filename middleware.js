const Listing = require('./models/listing');
const Review = require('./models/review.js');
const { listingSchema, reviewSch } = require("./schema.js");
const ExpressError = require("./utils/expressError.js");

// Auth now rides on a JWT (populated onto req.user by the global middleware in app.js),
// not on a server-side session.
module.exports.isLoggedin = (req, res, next) => {
    if (!req.user) {
        // Remember where the user was headed so we can return them there after login.
        // Stored in a short-lived cookie instead of req.session.
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

module.exports.isOwner = async (req, res, next) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing does not exist");
        return res.redirect("/listings");
    }
    if (!listing.ownerId.equals(req.user._id)) {
        req.flash("error", "you dont have permission to make changes");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
        req.flash("error", "Review does not exist");
        return res.redirect(`/listings/${id}`);
    }
    if (!review.authorId.equals(req.user._id)) {
        req.flash("error", "you dont have permission to make changes");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateReview = (req, res, next) => {
    let result = reviewSch.validate(req.body);
    if (result.error) {
        let errMsg = result.error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

module.exports.validateListing = (req, res, next) => {
    let result = listingSchema.validate(req.body);
    if (result.error) {
        let errMsg = result.error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};
