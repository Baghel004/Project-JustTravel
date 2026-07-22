// Gateway review proxy → review-service.
const { REVIEW_SERVICE_URL, identityHeaders } = require('../utils/http');

module.exports.createReview = async (req, res, next) => {
    try {
        const { id } = req.params; // listing id
        const r = await fetch(`${REVIEW_SERVICE_URL}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...identityHeaders(req) },
            body: JSON.stringify({ listingId: id, review: req.body.review }),
        });
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            req.flash("error", e.error || "Could not create review");
            return res.redirect(`/listings/${id}`);
        }
        req.flash("success", "Review Created");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        next(err);
    }
};

module.exports.deleteReview = async (req, res, next) => {
    try {
        const { id, reviewId } = req.params;
        const r = await fetch(`${REVIEW_SERVICE_URL}/reviews/${reviewId}`, {
            method: 'DELETE',
            headers: identityHeaders(req),
        });
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            req.flash("error", e.error || "Something went wrong while deleting the review.");
            return res.redirect(`/listings/${id}`);
        }
        req.flash("success", "Review deleted");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        next(err);
    }
};
