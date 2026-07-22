const Review = require('../models/review');

// GET /reviews?listingId=...  -> reviews for a listing (newest first)
module.exports.listByListing = async (req, res, next) => {
    try {
        const { listingId } = req.query;
        if (!listingId) return res.status(400).json({ error: 'listingId is required' });
        const reviews = await Review.find({ listingId }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        next(err);
    }
};

// POST /reviews  { listingId, review:{rating,comment} }  (identity via headers)
module.exports.create = async (req, res, next) => {
    try {
        const { listingId } = req.body;
        if (!listingId) return res.status(400).json({ error: 'listingId is required' });
        const review = new Review({
            ...req.body.review,
            listingId,
            authorId: req.identity.userId,
            authorUsername: req.identity.username, // denormalized for display
        });
        await review.save();
        res.status(201).json(review);
    } catch (err) {
        next(err);
    }
};

// DELETE /reviews/:id  (author-checked)
module.exports.remove = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (String(review.authorId) !== String(req.identity.userId)) {
            return res.status(403).json({ error: 'forbidden' });
        }
        await Review.findByIdAndDelete(review._id);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};

// DELETE /internal/reviews?listingId=...  -> bulk delete for the cascade from listing-service.
// No identity check: this is an internal endpoint invoked service-to-service.
module.exports.bulkDeleteByListing = async (req, res, next) => {
    try {
        const { listingId } = req.query;
        if (!listingId) return res.status(400).json({ error: 'listingId is required' });
        const result = await Review.deleteMany({ listingId });
        res.json({ ok: true, deleted: result.deletedCount });
    } catch (err) {
        next(err);
    }
};
