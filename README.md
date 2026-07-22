# Wanderlust — Microservices

An Airbnb-style travel listings app, being migrated from an Express monolith to a
microservices architecture (Docker + Kubernetes on AWS EC2, CI/CD via GitHub Actions,
monitoring via Grafana Cloud). See [`docs/MICROSERVICES-PLAN.md`](docs/MICROSERVICES-PLAN.md)
for the full blueprint.

## Services (monorepo)

```
services/
├── api-gateway/    Entry point: routes, JWT verification, EJS frontend,
│                   and (until Phase 3) listings + reviews. Proxies auth to user-service.
└── user-service/   Authentication & users. Owns its own database, issues JWTs.
```

## Running locally (Phase 2)

Each service is independent, with its own `package.json` and `.env`.

1. Copy the env templates and fill them in (a real MongoDB Atlas URL, a shared `JWT_SECRET`,
   Mapbox + Cloudinary keys for the gateway):
   ```bash
   cp services/user-service/.env.example services/user-service/.env
   cp services/api-gateway/.env.example  services/api-gateway/.env
   ```
   The `JWT_SECRET` **must be identical** in both (user-service signs, gateway verifies).

2. Install dependencies (once per service):
   ```bash
   (cd services/user-service && npm install)
   (cd services/api-gateway  && npm install)
   ```

3. Start both (separate terminals):
   ```bash
   cd services/user-service && npm run dev   # http://localhost:4001
   cd services/api-gateway  && npm run dev   # http://localhost:8080
   ```

Open http://localhost:8080. Signup/login flow through the gateway to the user-service;
listings/reviews are still served by the gateway (extracted in Phase 3).

Each service exposes `GET /metrics` (Prometheus) and the user-service also `GET /health`.
