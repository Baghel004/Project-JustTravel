const { Schema, model } = require('mongoose');

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    image: {
        url: String,
        filename: String,
    },
    price: {
        type: Number,
    },
    location: {
        type: String,
    },
    country: {
        type: String,
    },
    // Owner is referenced by id only (the user lives in the user-service DB, so no populate).
    // We store the id for authorization and the denormalized username for display.
    ownerId: {
        type: Schema.Types.ObjectId,
    },
    ownerUsername: {
        type: String,
    },
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
        },
    },
});

// NOTE: the old Mongoose cascade-delete hook is gone. Reviews now live in the
// review-service's own database, so cascade deletion is a synchronous HTTP call made
// from the controller (see cascadeDeleteReviews in controllers/listing.js).

const Listing = model("Listing", listingSchema);
module.exports = Listing;
