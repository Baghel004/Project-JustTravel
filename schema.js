const Joi = require('joi');

// Note: `image` is intentionally NOT validated here — it arrives as a multipart file
// (req.file via multer), not as a field on req.body.listing. Validating it as a body
// string was a bug that could reject valid submissions.
const listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        price: Joi.number().required().min(0),
        location: Joi.string().required(),
        country: Joi.string().required(),
    }).required(),
});

const reviewSch = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required(),
});

module.exports = { listingSchema, reviewSch };
