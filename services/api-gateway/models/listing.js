const { Schema, model } = require('mongoose');
const Review = require('./review');

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
    // Owner is referenced by id only. In the microservices split the user lives in a
    // different service/database, so we cannot populate across it — instead we store
    // the id (for authorization) plus the denormalized username (for display).
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
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

// Reviews no longer live inside the listing document; they reference it by listingId.
// On delete we cascade-remove them. (In the REST-only microservices design this hook
// becomes a synchronous call from listing-service to review-service — see the plan's
// cascadeDelete seam.)
listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        await Review.deleteMany({ listingId: listing._id });
    }
});

const Listing = model("Listing", listingSchema);
module.exports = Listing;
