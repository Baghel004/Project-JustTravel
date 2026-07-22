const Listing = require('../models/listing');
const { cloudinary } = require('../cloudConfig');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');

const REVIEW_SERVICE_URL = process.env.REVIEW_SERVICE_URL || 'http://localhost:4003';

// Lazy geocoding client — fixes the old module-load coupling where a valid MAP_TOKEN was
// required just to boot. The client is built on first use instead.
let _geocoder = null;
function geocoder() {
    if (!_geocoder) _geocoder = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });
    return _geocoder;
}

// The cascade-delete SEAM. Synchronous REST for now; to make it event-driven later,
// only this function changes — callers stay the same.
async function cascadeDeleteReviews(listingId) {
    try {
        await fetch(`${REVIEW_SERVICE_URL}/internal/reviews?listingId=${listingId}`, { method: 'DELETE' });
    } catch (err) {
        // Known tradeoff of synchronous cascade: a failure here orphans reviews (no retry).
        // A message broker would add durability — noted in the plan.
        console.error(`cascade delete of reviews for listing ${listingId} failed:`, err.message);
    }
}

// Cloudinary cleanup (the previously-deferred fix): remove the stored image so deleted/
// replaced listings don't leave orphaned assets.
async function destroyImage(listing) {
    if (listing && listing.image && listing.image.filename) {
        try {
            await cloudinary.uploader.destroy(listing.image.filename);
        } catch (err) {
            console.error('cloudinary destroy failed:', err.message);
        }
    }
}

module.exports.index = async (req, res, next) => {
    try {
        const listings = await Listing.find();
        res.json(listings);
    } catch (err) {
        next(err);
    }
};

module.exports.show = async (req, res, next) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        res.json(listing);
    } catch (err) {
        next(err);
    }
};

module.exports.create = async (req, res, next) => {
    try {
        const response = await geocoder()
            .forwardGeocode({ query: req.body.listing.location, limit: 2 })
            .send();
        const feature = response.body.features[0];
        if (!feature) return res.status(400).json({ error: 'Could not geocode that location' });

        const listing = new Listing(req.body.listing);
        listing.ownerId = req.identity.userId;
        listing.ownerUsername = req.identity.username;
        listing.geometry = feature.geometry;
        listing.image = { url: req.file.path, filename: req.file.filename };
        await listing.save();
        res.status(201).json(listing);
    } catch (err) {
        next(err);
    }
};

module.exports.update = async (req, res, next) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        if (String(listing.ownerId) !== String(req.identity.userId)) {
            return res.status(403).json({ error: 'forbidden' });
        }
        Object.assign(listing, req.body.listing);
        if (req.file) {
            await destroyImage(listing); // remove the OLD image before swapping in the new one
            listing.image = { url: req.file.path, filename: req.file.filename };
        }
        await listing.save();
        res.json(listing);
    } catch (err) {
        next(err);
    }
};

module.exports.remove = async (req, res, next) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        if (String(listing.ownerId) !== String(req.identity.userId)) {
            return res.status(403).json({ error: 'forbidden' });
        }
        await Listing.findByIdAndDelete(listing._id);
        await destroyImage(listing);              // clean up the Cloudinary asset
        await cascadeDeleteReviews(listing._id);  // clean up reviews in the review-service
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
