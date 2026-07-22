const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.js');

router.get('/signup', UserController.showSignup);

router.post('/signup', UserController.doSignup);

router.get("/login", UserController.showLogin);

// Auth is verified inside the controller (JWT issued), replacing passport.authenticate.
router.post("/login", UserController.login);

router.get("/logout", UserController.doLogout);

module.exports = router;
