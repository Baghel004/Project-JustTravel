# Wanderlust — Microservices

An Airbnb-style travel listings app, migrated from an Express monolith to a microservices
architecture (Docker + Kubernetes on AWS EC2, CI/CD via GitHub Actions, monitoring via
Grafana Cloud). See [`docs/MICROSERVICES-PLAN.md`](docs/MICROSERVICES-PLAN.md) for the full blueprint.

## Services (monorepo)

```
services/
├── api-gateway/     Stateless entry point (no DB): routing, JWT verification, EJS frontend,
│                    and cross-service aggregation. Proxies to the domain services.
├── user-service/    Auth & users. Owns its DB. Issues JWTs.        (port 4001)
├── listing-service/ Listings CRUD, Cloudinary uploads, Mapbox geocoding, cascade-delete
│                    trigger. Owns its DB.                          (port 4002)
└── review-service/  Reviews CRUD + internal bulk-delete. Owns its DB. (port 4003)
```

Database-per-service (separate databases in one MongoDB Atlas cluster):
`wanderlust_users`, `wanderlust_listings`, `wanderlust_reviews`.

## How it fits together

- The **gateway** verifies the JWT cookie and forwards identity to services via `X-User-Id` /
  `X-User-Name` headers. Services are internal-only and trust those headers.
- **Auth**: gateway → user-service (issues JWT). **Listings/Reviews**: gateway proxies and, for
  the show page, aggregates listing + reviews across two services.
- **Cascade delete**: deleting a listing makes the listing-service call
  `DELETE /internal/reviews?listingId=...` on the review-service (synchronous REST).

## Running locally

Each service is independent (own `package.json` + `.env`).

1. Copy env templates and fill them in. The **`JWT_SECRET` must be identical** in the gateway
   and user-service; each service needs its own DB URL.
   ```bash
   for s in api-gateway user-service listing-service review-service; do
     cp services/$s/.env.example services/$s/.env
   done
   ```

2. Install dependencies (once per service):
   ```bash
   for s in api-gateway user-service listing-service review-service; do
     (cd services/$s && npm install)
   done
   ```

3. Start all four (separate terminals):
   ```bash
   cd services/user-service    && npm run dev   # :4001
   cd services/listing-service && npm run dev   # :4002
   cd services/review-service  && npm run dev   # :4003
   cd services/api-gateway     && npm run dev   # :8080
   ```

Open http://localhost:8080. Every service exposes `GET /metrics` (Prometheus) and `GET /health`.

## Running with Docker

The whole stack builds and runs with one command. Databases stay on MongoDB Atlas (external).

1. Copy the root env template and fill it in (shared `JWT_SECRET`, three Atlas DB URLs, Mapbox +
   Cloudinary keys):
   ```bash
   cp .env.example .env
   ```
2. Build and start everything:
   ```bash
   docker compose up --build -d
   ```
3. Open http://localhost:8080. Only the gateway is published (`:8080`); the domain services are
   reachable only on the internal compose network. Each has a healthcheck.

```bash
docker compose ps        # status + health
docker compose logs -f   # tail logs
docker compose down      # stop & remove
```

Each service has its own multi-stage `Dockerfile` (`node:20-alpine`, non-root, `npm ci --omit=dev`).
