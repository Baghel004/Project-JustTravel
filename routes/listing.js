const express = require('express')
const router = express.Router();
const Listing = require('../models/listing.js');
const {isLoggedin,isOwner,validateListing}= require('../middleware.js');
const listingController  = require('../controllers/listing.js')
const multer = require('multer')
const {storage} = require('../cloudConfig.js')
const upload = multer({storage})



router.get("/",listingController.index)

router.get("/new",isLoggedin,listingController.NewRoute)

router.post("/",isLoggedin,upload.single("listing[image]"),validateListing,listingController.createRoute)


router.get("/:id",listingController.showListing)

router.get("/:id/edit",isLoggedin,isOwner,listingController.editListing)

router.put("/:id",isLoggedin,isOwner,upload.single("listing[image]"),validateListing,listingController.updateListing)

router.delete("/:id",isLoggedin,isOwner,listingController.deleteListing)

module.exports = router;