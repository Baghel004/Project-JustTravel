const Joi = require('joi');

// Validation is owned by the service that owns the data. `image` is not validated here —
// it arrives as a multipart file (req.file), not a body field.
const listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        price: Joi.number().required().min(0),
        location: Joi.string().required(),
        country: Joi.string().required(),
    }).required(),
});

module.exports = { listingSchema };
