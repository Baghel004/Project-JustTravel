const { Schema, model } = require('mongoose');

const reviewSchema = new Schema({
    comment: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now, // function ref, evaluated per-document (was Date.now() — a bug)
    },
    // Reviews reference their listing and author by id only (those live in other services'
    // databases, so no populate — refs are omitted). authorUsername is denormalized for
    // display so the gateway never needs a per-review lookup to the user-service.
    listingId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    authorId: {
        type: Schema.Types.ObjectId,
    },
    authorUsername: {
        type: String,
    },
});

const Review = model("Review", reviewSchema);
module.exports = Review;
