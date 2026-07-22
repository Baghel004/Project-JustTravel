// Prometheus instrumentation. Added in Phase 1 so the app is observable from birth;
// when the monolith is split, each service reuses this module and the Grafana Alloy
// agent scrapes every /metrics endpoint. Exposes RED metrics (Rate, Errors, Duration)
// plus default Node process metrics (event loop, heap, GC).

const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({ app: 'wanderlust' });
client.collectDefaultMetrics({ register });

const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
});
register.registerMetric(httpDuration);

// Collapse Mongo ObjectIds in the path to ':id' so label cardinality stays bounded
// (otherwise every listing/review id would create a new time series).
function normalizeRoute(req) {
    const base = req.baseUrl || '';
    const matched = req.route && req.route.path ? req.route.path : req.path;
    const full = (base + matched) || '/';
    return full.replace(/[0-9a-fA-F]{24}/g, ':id');
}

function metricsMiddleware(req, res, next) {
    if (req.path === '/metrics') return next();
    const end = httpDuration.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: normalizeRoute(req), status: res.statusCode });
    });
    next();
}

async function metricsHandler(req, res) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}

module.exports = { register, metricsMiddleware, metricsHandler };
