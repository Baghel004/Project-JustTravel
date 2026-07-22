const express = require('express');
const router = express.Router({ mergeParams: true });
const { isLoggedin } = require('../middleware.js');
const ReviewController = require('../controllers/review.js');

router.post("/", isLoggedin, ReviewController.createReview);

router.delete("/:reviewId", isLoggedin, ReviewController.deleteReview);

module.exports = router;
