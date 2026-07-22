const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/review');
const { requireIdentity, validateReview } = require('../middleware');

// Internal cascade endpoint (service-to-service, no identity)
router.delete('/internal/reviews', ctrl.bulkDeleteByListing);

router.get('/reviews', ctrl.listByListing);
router.post('/reviews', requireIdentity, validateReview, ctrl.create);
router.delete('/reviews/:id', requireIdentity, ctrl.remove);

module.exports = router;
