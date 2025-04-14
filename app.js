if(process.env.NODE_ENV != "production"){
    require("dotenv").config()
}


const express = require('express');
const app = express();
const mongoose = require('mongoose');
const dbUrl = process.env.MONGO_URL;
const path  = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
app.set("view engine","ejs");
app.engine("ejs",ejsMate);
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname,"public")));

const ExpressError = require("./utils/expressError.js");
const reviewRouter = require('./routes/review.js')
const listingRouter = require('./routes/listing.js');
const userRouter = require('./routes/user.js')


const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const passportLocal = require("passport-local");
const User = require('./models/user.js');

const store =  MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
      secret:  process.env.SECRET
    },
    touchAfter:24*3600,
  });

  store.on("error",(err)=>{
    console.log("error in mongo session store",err)
  })

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires:Date.now()+7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true,
    }
}

app.use(session(sessionOptions))
app.use(flash());


app.use(passport.initialize());
app.use(passport.session());
passport.use(new passportLocal.Strategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user|| null;
    next();
})


const connectDb = async function(){
    try{
        const connect = await mongoose.connect(dbUrl);
        console.log("connceted to db");
    }catch(err){
        console.log(err.message);
    }   
}
connectDb();

app.use('/listings',listingRouter);
app.use('/listings/:id/reviews',reviewRouter);
app.use('/',userRouter);


app.all("*",(req,res,next)=>{
    next(new ExpressError(404,"Page Not Found"));
})

app.use((err,req,res,next)=>{
    let{status=500,message="some error occurred"} = err;
    res.status(status).render("listings/error.ejs",{message,errorCss:true});
})

app.listen(process.env.PORT,(req,res)=>{
    console.log("listening on port ");
})