const Review = require('../models/review.js')
const Listing = require('../models/listing.js');

module.exports.createReview = async (req, res, next) => {
    try {
        let listing = await Listing.findById(req.params.id);
        let newReview = new Review(req.body.review);
        newReview.author = req.user._id;
        listing.reviews.push(newReview);
        let data = await newReview.save();
        await listing.save();
        req.flash("success", "Review Created");
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        next(err);
    }
}

module.exports.deleteReview = async (req, res) => {
    const { id, reviewId } = req.params;

    try {
        // Remove the review reference from the listing
        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });

        // Delete the review itself
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review deleted");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        req.flash("error", "Something went wrong while deleting the review.");
        res.redirect(`/listings/${id}`);
    }
};
