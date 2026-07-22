const express = require('express');
const router = express.Router();
const { isLoggedin } = require('../middleware.js');
const listingController = require('../controllers/listing.js');
const multer = require('multer');
// Buffer the upload in memory so the gateway can forward it to the listing-service.
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", listingController.index);

router.get("/new", isLoggedin, listingController.NewRoute);

router.post("/", isLoggedin, upload.single("listing[image]"), listingController.createRoute);

router.get("/:id", listingController.showListing);

router.get("/:id/edit", isLoggedin, listingController.editListing);

router.put("/:id", isLoggedin, upload.single("listing[image]"), listingController.updateListing);

router.delete("/:id", isLoggedin, listingController.deleteListing);

module.exports = router;
