// The gateway holds no database. It calls the listing-service (and review-service, for
// the show page) over HTTP, then renders EJS. Multipart uploads are buffered here and
// forwarded to the listing-service, which owns Cloudinary.
const { LISTING_SERVICE_URL, REVIEW_SERVICE_URL, identityHeaders } = require('../utils/http');

// Build a multipart body from the parsed form + buffered file to forward upstream.
function listingFormData(req) {
    const fd = new FormData();
    const listing = req.body.listing || {};
    for (const key of Object.keys(listing)) {
        fd.append(`listing[${key}]`, listing[key]);
    }
    if (req.file) {
        fd.append(
            'listing[image]',
            new Blob([req.file.buffer], { type: req.file.mimetype }),
            req.file.originalname
        );
    }
    return fd;
}

module.exports.index = async (req, res, next) => {
    try {
        const r = await fetch(`${LISTING_SERVICE_URL}/listings`);
        const allListings = await r.json();
        res.render("listings/index.ejs", { allListings, cardsCss: true });
    } catch (err) {
        next(err);
    }
};

module.exports.NewRoute = (req, res) => {
    res.render("listings/new.ejs", { newCss: true });
};

module.exports.createRoute = async (req, res, next) => {
    try {
        const r = await fetch(`${LISTING_SERVICE_URL}/listings`, {
            method: 'POST',
            headers: identityHeaders(req),
            body: listingFormData(req),
        });
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            req.flash("error", e.error || "Could not create listing");
            return res.redirect("/listings/new");
        }
        req.flash("success", "New listing created successfully!");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
};

module.exports.showListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        const lr = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`);
        if (lr.status === 404) {
            req.flash("error", "Listing does not exist");
            return res.redirect("/listings");
        }
        const listing = await lr.json();
        // Aggregate: fetch this listing's reviews from the review-service.
        const rr = await fetch(`${REVIEW_SERVICE_URL}/reviews?listingId=${id}`);
        const reviews = rr.ok ? await rr.json() : [];
        res.render("listings/show.ejs", { listing, reviews, showCss: true });
    } catch (err) {
        next(err);
    }
};

module.exports.editListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        const lr = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`);
        if (lr.status === 404) {
            req.flash("error", "Listing does not exist");
            return res.redirect("/listings");
        }
        const listing = await lr.json();
        // The listing-service enforces ownership authoritatively on PUT; guard the UI here too.
        if (!req.user || String(req.user._id) !== String(listing.ownerId)) {
            req.flash("error", "you dont have permission to make changes");
            return res.redirect(`/listings/${id}`);
        }
        const finalurl = listing.image.url.replace("/upload", "/upload/h_100,w_100,e_blur:300");
        res.render("listings/edit.ejs", { listing, finalurl, editCss: true });
    } catch (err) {
        next(err);
    }
};

module.exports.updateListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        const r = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
            method: 'PUT',
            headers: identityHeaders(req),
            body: listingFormData(req),
        });
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            req.flash("error", e.error || "Could not update listing");
            return res.redirect(`/listings/${id}/edit`);
        }
        req.flash("success", "Listing Updated!");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        next(err);
    }
};

module.exports.deleteListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        const r = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
            method: 'DELETE',
            headers: identityHeaders(req),
        });
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            req.flash("error", e.error || "Could not delete listing");
            return res.redirect(`/listings/${id}`);
        }
        req.flash("success", "Listing Deleted!");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
};
