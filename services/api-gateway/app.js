if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require('express');
const app = express();
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const cookieParser = require('cookie-parser');

const ExpressError = require("./utils/expressError.js");
const { verifyToken, COOKIE } = require('./utils/jwt.js');
const cookieFlash = require('./utils/flash.js');
const { metricsMiddleware, metricsHandler } = require('./utils/metrics.js');

const reviewRouter = require('./routes/review.js');
const listingRouter = require('./routes/listing.js');
const userRouter = require('./routes/user.js');

app.set("view engine", "ejs");
app.engine("ejs", ejsMate);
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// --- Observability: time every request; expose Prometheus metrics ---
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

// --- Cookie-based flash (replaces connect-flash; no session store needed) ---
app.use(cookieFlash);

// --- Auth: populate req.user from the JWT cookie (replaces passport session) ---
app.use((req, res, next) => {
    const token = req.cookies[COOKIE];
    if (token) {
        try {
            const payload = verifyToken(token);
            req.user = { _id: payload.sub, username: payload.username };
        } catch (e) {
            res.clearCookie(COOKIE); // expired/invalid token
            req.user = null;
        }
    } else {
        req.user = null;
    }
    res.locals.currUser = req.user;
    res.locals.redirectUrl = req.cookies.redirectUrl || null;
    next();
});

// The gateway owns no database — it routes/aggregates across the domain services.

app.use('/listings', listingRouter);
app.use('/listings/:id/reviews', reviewRouter);
app.use('/', userRouter);

app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
    let { status = 500, message = "some error occurred" } = err;
    res.status(status).render("listings/error.ejs", { message, errorCss: true });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
