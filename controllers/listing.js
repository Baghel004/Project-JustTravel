const Listing = require('../models/listing')
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const map_token = (process.env.MAP_TOKEN);
const geocodingClient= mbxGeocoding({ accessToken: map_token });



module.exports.index = async (req, res, next) => {
    try {
        const allListings = await Listing.find();
        res.render("listings/index.ejs", { allListings, cardsCss: true })
    } catch (err) {
        next(err);
    }
};

module.exports.NewRoute = async (req, res, next) => {
    try {
        res.render("listings/new.ejs", { newCss: true });
    } catch (err) {
        next(err);
    }
}

module.exports.createRoute = async (req, res, next) => {
    try {
        console.log('request gone')
        const response = await geocodingClient.forwardGeocode({
            query: req.body.listing.location,
            limit: 2
          }).send()
       
        const geo =  response.body.features[0].geometry;
        const url = req.file.path;
        const filename = req.file.filename;
        const listing = req.body.listing;
        const newListing = new Listing(listing);
        newListing.owner = req.user._id;
        newListing.image= {url,filename};
        newListing.geometry = geo;
        await newListing.save();
        req.flash("success", "New listing created successfully!");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
}

module.exports.showListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id).populate({ path: "reviews", populate: { path: "author" } }).populate("owner");
        if (!listing) {
            req.flash("error", "Listing does not exist");
            res.redirect("/listings");
        }
       
        res.render("listings/show.ejs", { listing, showCss: true });
    } catch (err) {
        next(err);

    }
}

module.exports.editListing = async (req, res, next) => {
    try {

        const { id } = req.params;
        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash("error", "Listing does not exist");
            res.redirect("/listings");
        }
        let  originalu = listing.image.url;
        let finalurl =  originalu.replace("/upload","/upload/h_100,w_100,e_blur:300")
        res.render("listings/edit.ejs", { listing,finalurl, editCss: true });

    } catch (err) {
        next(err);

    }

}

module.exports.deleteListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndDelete(id);
        req.flash("success", "Listing Deleted!");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
}

module.exports.updateListing = async (req, res, next) => {
    try {
        const { id } = req.params;
      const newList =   await Listing.findByIdAndUpdate(id, { ...req.body.listing });
        if(typeof(req.file)!=='undefined'){
            const url = req.file.path;
            const filename = req.file.filename;
            newList.image = {url,filename};
            await newList.save();
        }

        req.flash("success", "Listing Updated!");
        res.redirect(`/listings/${id}`);

    } catch (err) {
        next(err);
    }

}