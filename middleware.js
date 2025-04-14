const Listing = require('./models/listing')
const Review = require('./models/review.js')
const {listingSchema,reviewSch} = require("./schema.js");
const ExpressError = require("./utils/expressError.js");



module.exports.isLoggedin = (req,res,next)=>{
    if(!req.isAuthenticated()){
        if (req.method === "GET") {
            req.session.redirectUrl = req.originalUrl;
        } else if (req.headers.referer) {
            const url = new URL(req.headers.referer);
            req.session.redirectUrl = url.pathname;
        }
        
        req.flash("success","you must be signed in ")
         return res.redirect("/login")
    }
    next();
}

module.exports.isOwner = async(req,res,next)=>{
    const {id} =req.params;
    const listing = await Listing.findById(id)
    if(! (res.locals.currUser._id.equals(listing.owner._id))){
        req.flash("error","you dont have permission to make changes")
        return res.redirect(`/listings/${id}`);
    }
    next()
}

module.exports.isAuthor = async(req,res,next)=>{
    const {id,reviewId} =req.params;
    const review = await Review.findById(reviewId)
    if(! (res.locals.currUser._id.equals(review.author._id))){
        req.flash("error","you dont have permission to make changes")
        return res.redirect(`/listings/${id}`);
    }
    next()
}

module.exports.validateReview = (req,res,next)=>{
    let result = reviewSch.validate(req.body);
    if(result.error){
        let errMsg = result.error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }
}


module.exports.validateListing = (req,res,next)=>{
    let result = listingSchema.validate(req.body);
        
        if(result.error){
            let errMsg = result.error.details.map((el)=>el.message).join(",");
            throw new ExpressError(400,errMsg);
        }else{
            next();
        }

}