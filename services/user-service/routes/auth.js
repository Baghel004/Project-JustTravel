const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.js');

router.post('/auth/signup', ctrl.signup);
router.post('/auth/login', ctrl.login);
router.post('/users/batch', ctrl.batch);

module.exports = router;
