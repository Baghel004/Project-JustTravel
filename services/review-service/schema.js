const Joi = require('joi');

// Validates the review payload itself (the gateway sends { listingId, review }, so we
// validate req.body.review — see middleware).
const reviewSch = Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
});

module.exports = { reviewSch };
