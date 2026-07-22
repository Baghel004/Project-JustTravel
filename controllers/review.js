const Review = require('../models/review.js');
const Listing = require('../models/listing.js');

module.exports.createReview = async (req, res, next) => {
    try {
        const { id } = req.params; // listing id
        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash("error", "Listing does not exist");
            return res.redirect("/listings");
        }
        const newReview = new Review({
            ...req.body.review,
            listingId: id,
            authorId: req.user._id,
            authorUsername: req.user.username, // denormalized for display
        });
        await newReview.save();
        req.flash("success", "Review Created");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        next(err);
    }
};

module.exports.deleteReview = async (req, res) => {
    const { id, reviewId } = req.params;
    try {
        await Review.findByIdAndDelete(reviewId);
        req.flash("success", "Review deleted");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        req.flash("error", "Something went wrong while deleting the review.");
        res.redirect(`/listings/${id}`);
    }
};
