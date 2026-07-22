if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require('express');
const mongoose = require('mongoose');
const app = express();

const dbUrl = process.env.USERS_DB_URL;
const authRouter = require('./routes/auth.js');
const { metricsMiddleware, metricsHandler } = require('./utils/metrics.js');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Observability
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }));

// Internal API (only reachable inside the cluster, never internet-exposed)
app.use('/', authRouter);

// JSON error handler (services speak JSON, not HTML)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

const connectDb = async () => {
    try {
        await mongoose.connect(dbUrl);
        console.log("user-service: connected to db");
    } catch (err) {
        console.log("user-service db error:", err.message);
    }
};
connectDb();

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`user-service listening on port ${PORT}`);
});
