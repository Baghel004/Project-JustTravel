const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../cloudConfig');
const upload = multer({ storage });
const ctrl = require('../controllers/listing');
const { requireIdentity, validateListing } = require('../middleware');

router.get('/', ctrl.index);
router.get('/:id', ctrl.show);
router.post('/', requireIdentity, upload.single('listing[image]'), validateListing, ctrl.create);
router.put('/:id', requireIdentity, upload.single('listing[image]'), validateListing, ctrl.update);
router.delete('/:id', requireIdentity, ctrl.remove);

module.exports = router;
