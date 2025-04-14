const User = require('../models/user');

module.exports.doSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to Wanderlust");
            res.redirect("/listings");
        })

    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup")
    }

}


module.exports.doLogout = (req, res) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "logged out successfully")
        res.redirect('/listings')

    })
}

module.exports.showSignup = (req, res) => {
    res.render("users/signup.ejs",{signupCss:true});
}

module.exports.showLogin = (req, res) => {
    res.render("users/login.ejs",{signupCss:true});
}

module.exports.authenicateUser = async (req, res) => {
    req.flash("success", "Welcome to Wanderlust");
  
    let redirectUrl = res.locals.redirectUrl || "/listings"
    
    res.redirect(redirectUrl)
}