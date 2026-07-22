const express = require('express');
const router = express.Router({mergeParams:true});
const Listing = require('../models/listing.js');
const Review = require('../models/review.js');
const {validateReview,isLoggedin,isAuthor} = require('../middleware.js')
const ReviewController = require('../controllers/review.js')




router.post("/",isLoggedin,validateReview,ReviewController.createReview)


router.delete("/:reviewId",isLoggedin,isAuthor,ReviewController.deleteReview)



module.exports = router;