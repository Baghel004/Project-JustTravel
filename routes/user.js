const express = require('express');
const User = require('../models/user');
const router = express.Router();
const passport = require('passport')
const UserController = require('../controllers/user.js')

router.get('/signup',UserController.showSignup)

router.post('/signup',UserController.doSignup)

router.get("/login",UserController.showLogin)

router.post("/login",passport.authenticate(
    'local',{failureRedirect:"/login",failureFlash:true
    }
),UserController.authenicateUser)

router.get("/logout",UserController.doLogout)

module.exports= router;