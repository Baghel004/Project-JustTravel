# Wanderlust — Monolith → Microservices Migration Plan

> A formal, free-tier-conscious blueprint for converting the Wanderlust (Airbnb-clone)
> Express monolith into a Kubernetes-hosted microservices system on AWS EC2, with Docker
> and a GitHub Actions CI/CD pipeline.
>
> **Primary goal:** showcase microservices, containerization, Kubernetes, and CI/CD skills
> for a portfolio — *not* to serve production traffic. Every decision below is optimized for
> "impressive but defensible in an interview" and "runs on free / near-free accounts."

---

## 0. Cost & free-tier strategy (the governing constraint)

Everything is designed to fit within these free-tier accounts:

| Account | Free-tier allowance | How we use it |
|---|---|---|
| **AWS (12-mo free tier)** | 750 hrs/mo of `t2.micro`/`t3.micro`, 30 GB EBS, 15 GB egress | 1× EC2 instance running single-node k3s |
| **MongoDB Atlas** | 1× M0 cluster (512 MB, shared), free forever | 1 cluster, 3 logical databases (one per service) |
| **GitHub** | Actions: 2,000 min/mo private (unlimited public); GHCR free for public images | CI/CD + public image registry |
| **Grafana Cloud** | Free tier: 10k active series, 14-day retention, 3 users | Hosted Prometheus + Grafana; node runs only a light agent |
| **Elastic IP** | Free while attached to a *running* instance | Stable demo URL across reboots |

### The one honest tension: RAM
`t3.micro` = **1 GB RAM**. k3s (~512 MB) + 5 Node services is genuinely tight. Two paths:

- **Free path (default in this plan):** `t3.micro` + **2 GB swap file** on EBS + strict per-pod
  memory limits + minimal Alpine images. Works for a low-traffic demo. Accept that it's tight.
- **Safe path (~$15/mo):** upgrade to `t3.small` (2 GB). One-line change (instance type); do this
  if the free node thrashes under demo load.

**Cost hygiene:** `stop` the EC2 instance between demos (you keep the EBS + Elastic IP),
set an **AWS billing alarm** at $5, and keep GHCR images **public** so they're free.

> "A few free-tier accounts": we deliberately keep everything inside **one** AWS account and
> **one** Atlas account. Spreading a cluster across multiple free accounts (to dodge limits)
> is fragile, cross-account networking is painful, and it reads as a hack rather than a skill.
> If you later want a real multi-node cluster, upgrade the node — don't multiply accounts.

---

## 1. Target architecture

```
                        Internet
                           │
                    Elastic IP (AWS)
                           │
        ┌──────────────────▼───────────────────┐
        │      EC2 (t3.micro) — single node     │
        │             k3s cluster               │
        │                                       │
        │    nginx Ingress ──► API Gateway      │
        │                          │            │
        │        ┌─────────────────┼─────────┐  │
        │        ▼                 ▼         ▼  │
        │   User/Auth svc    Listing svc  Review svc
        │        │                 │         │  │
        │        └────────┬────────┴─────────┘  │
        │                 │ /metrics scraped     │
        │          Grafana Alloy agent ──────────┼──► Grafana Cloud
        │                                        │    (hosted Prometheus
        └────────┼─────────────────┼─────────┼──┘     + Grafana dashboards)
                 │                 │         │
                 ▼                 ▼         ▼
            Atlas: usersDB   Atlas: listingsDB   Atlas: reviewsDB
                              (Cloudinary, Mapbox)
                 ▲
                 │ images pulled by k3s
              GHCR (GitHub Container Registry)
```

- **API Gateway** is the only pod exposed via Ingress. It routes, verifies JWTs, **aggregates**
  responses across services, and **serves the thin EJS frontend**.
- Each domain service owns its own database and is reachable only inside the cluster
  (ClusterIP), never directly from the internet.

---

## 2. Service decomposition

| Service | Owns | Responsibilities | External deps |
|---|---|---|---|
| **api-gateway** | — | Ingress target; route to services; verify JWT; aggregate show-page data; render/serve EJS views; static assets | — |
| **user-service** | `usersDB` | signup, login (issue JWT), user lookup by id (batch) | — |
| **listing-service** | `listingsDB` | listing CRUD; image upload; geocoding; emit cascade-delete call | Cloudinary, Mapbox |
| **review-service** | `reviewsDB` | review CRUD; bulk-delete by listingId | — |

**Deliberately NOT split further.** A service per model beyond this adds ceremony without
signal. 3 domain services + gateway is the defensible sweet spot.

---

## 3. Data model & database-per-service

Each service connects **only** to its own database, using its own Atlas user/credentials.
Physically these are 3 databases in one free M0 cluster; logically they're isolated (no service
reads another's collections). That isolation — enforced by credentials — is the microservices
property that matters, and it's honest to describe it that way.

### Denormalization (solves the N+1 fan-out)
Because the gateway aggregates over REST with no shared DB, we duplicate a few *display* fields
at write time so the show page needs O(1) calls, not one call per review author:

- **Listing** gains `ownerUsername` (copied from the JWT/user at create time).
- **Review** gains `authorUsername` (copied at create time).

Show-page aggregation then becomes: `GET listing` → `GET reviews?listingId=` → done.
No per-review user lookups.

| Collection | Fields (changes in **bold**) |
|---|---|
| users | `_id, username, email, hash, salt` |
| listings | `_id, title, description, image{url,filename}, price, location, country, geometry, ownerId, `**`ownerUsername`** |
| reviews | `_id, comment, rating, createdAt, listingId, authorId, `**`authorUsername`** |

Note: `reviews` no longer live *inside* the listing document (no `reviews[]` array). Reviews are
queried by `listingId`. This decouples the two services cleanly.

---

## 4. Authentication (sessions → JWT)

The biggest structural change. We drop `express-session` + connect-mongo entirely.

- **user-service** verifies credentials (keep `passport-local-mongoose` hashing) and issues a
  **signed JWT** (`{ sub: userId, username }`, short expiry + refresh optional — keep it simple:
  a single 7-day access token to start).
- The JWT is stored in an **httpOnly cookie** (so the EJS frontend keeps working without JS
  token handling).
- **api-gateway** verifies the JWT on every request using the shared `JWT_SECRET`, and forwards
  the decoded identity to downstream services via a trusted header (e.g. `X-User-Id`,
  `X-User-Name`). Downstream services trust the gateway (they're not internet-exposed).
- Authorization (`isOwner`, `isAuthor`) moves into the owning service, checked against
  `ownerId`/`authorId` vs the forwarded identity.

---

## 5. Inter-service communication

- **Synchronous REST** only. Services talk over cluster-internal DNS
  (`http://listing-service:3000`).
- **Cascade delete** (listing deleted → its reviews removed): `listing-service` makes a
  synchronous `DELETE http://review-service:3000/internal/reviews?listingId=<id>` after deleting
  the listing.
  - **Known tradeoff (interview-ready):** if that call fails, reviews are orphaned; there's no
    retry. A message broker (RabbitMQ) would fix this with an event + retry. We leave a clear
    seam — a single `cascadeDelete()` function — so swapping to events later is a localized
    change, not a rewrite. This is the deliberate cost of choosing REST-only for simplicity.

---

## 6. Repository layout (monorepo)

```
Project-JustTravel/
├── services/
│   ├── api-gateway/      (Express + EJS views + static + Dockerfile)
│   ├── user-service/     (Express + Mongoose + Dockerfile)
│   ├── listing-service/  (Express + Mongoose + Cloudinary + Mapbox + Dockerfile)
│   └── review-service/   (Express + Mongoose + Dockerfile)
├── k8s/                  (Kubernetes manifests)
│   ├── namespace.yaml
│   ├── gateway.yaml       (Deployment + Service + Ingress)
│   ├── user.yaml          (Deployment + Service)
│   ├── listing.yaml
│   ├── review.yaml
│   └── secrets.example.yaml
├── docker-compose.yml    (full local stack)
├── .github/workflows/
│   └── ci-cd.yml
└── docs/
    └── MICROSERVICES-PLAN.md   (this file)
```

The current monolith's `views/`, `public/`, and shared helpers migrate into `api-gateway/`.
`models/`, `controllers/`, `routes/`, `middleware.js`, `schema.js` are split across the three
domain services.

---

## 7. API contracts (per service)

All services listen on container port `3000`. Only the gateway is Ingress-exposed.

### api-gateway (public)
| Method | Path | Purpose |
|---|---|---|
| GET | `/listings` | render index (calls listing-service) |
| GET | `/listings/:id` | render show (aggregates listing + reviews) |
| GET/POST | `/listings/new`, `/listings` | render/create (proxy, multipart) |
| GET/PUT/DELETE | `/listings/:id/edit`, `/listings/:id` | edit/update/delete (proxy) |
| POST/DELETE | `/listings/:id/reviews`, `/.../reviews/:rid` | review proxy |
| GET/POST | `/signup`, `/login`, `/logout` | auth (proxy to user-service, set cookie) |

### user-service (internal)
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | create user, return JWT |
| POST | `/auth/login` | verify creds, return JWT |
| POST | `/users/batch` | resolve `[userId]` → `[{id, username}]` (fallback if denorm misses) |

### listing-service (internal)
| Method | Path | Purpose |
|---|---|---|
| GET | `/listings` | list all |
| GET | `/listings/:id` | one listing |
| POST | `/listings` | create (multipart image, geocode) — requires `X-User-*` |
| PUT | `/listings/:id` | update (owner-checked) |
| DELETE | `/listings/:id` | delete (owner-checked) + cascade to reviews |

### review-service (internal)
| Method | Path | Purpose |
|---|---|---|
| GET | `/reviews?listingId=` | reviews for a listing |
| POST | `/reviews` | create (requires `X-User-*`) |
| DELETE | `/reviews/:id` | delete (author-checked) |
| DELETE | `/internal/reviews?listingId=` | bulk delete for cascade |

Validation (Joi) stays with each owning service. The `schema.js` `image` mismatch is fixed
(image handled as a multipart file, removed from the body schema).

---

## 8. Configuration & secrets

Per-service env vars (never committed; injected via k8s Secrets / compose `.env`):

| Service | Vars |
|---|---|
| all | `PORT`, `NODE_ENV`, `JWT_SECRET` |
| user | `USERS_DB_URL` |
| listing | `LISTINGS_DB_URL`, `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`, `MAP_TOKEN`, `REVIEW_SERVICE_URL` |
| review | `REVIEWS_DB_URL` |
| gateway | `USER_SERVICE_URL`, `LISTING_SERVICE_URL`, `REVIEW_SERVICE_URL`, `JWT_SECRET`, `MAP_TOKEN` |
| alloy agent | `GRAFANA_CLOUD_URL`, `GRAFANA_CLOUD_API_KEY` (remote-write creds) |

In k8s these become one `Secret` per namespace; `secrets.example.yaml` is committed with
placeholder values as documentation.

---

## 9. Docker strategy

- One **multi-stage** Dockerfile per service, `node:20-alpine` base, non-root user, production
  `npm ci --omit=dev`. Target image size < 150 MB (matters on a 1 GB node).
- **`docker-compose.yml`** brings up all 4 services locally, wired by service name, reading a
  local `.env`. This is your fast dev loop and mirrors the k8s topology.
- `.dockerignore` excludes `node_modules`, `.env`, `.git`.

---

## 10. Kubernetes (single-node k3s on EC2)

**Node bootstrap (one-time, documented as a script):**
1. Launch `t3.micro`, Amazon Linux 2023, 30 GB gp3 EBS.
2. Security Group: inbound `22` (your IP only), `80`, `443`. (k3s API `6443` stays local.)
3. Attach an **Elastic IP**.
4. Add a **2 GB swap file** (mitigates the 1 GB RAM ceiling).
5. Install k3s (`curl -sfL https://get.k3s.io | sh -`) — bundles containerd + Traefik, but we
   disable Traefik and install **nginx ingress** for a more conventional/portable story.

**Per-service manifest** = `Deployment` (1 replica, `resources.limits.memory` ~128–160 Mi) +
`ClusterIP Service`. Only the gateway adds an `Ingress`.

**Image pulls from GHCR:** an `imagePullSecret` (or public images → no secret needed; we keep
images public to stay free and simple).

**Resource budget (fits ~1 GB + swap):**
| Pod | mem limit |
|---|---|
| k3s system | ~400 Mi |
| gateway | 160 Mi |
| user / listing / review | 128 Mi each |
| Grafana Alloy agent | ~64–80 Mi |

> With the agent added, the node is tight — this is the scenario where the 2 GB swap earns its
> keep, and the first candidate to justify a `t3.small` bump if demos stutter.

---

## 10b. Monitoring (Grafana Cloud free tier)

Dashboards are hosted; the node stays light. The metrics *brains* (Prometheus + Grafana) live in
Grafana Cloud — only a small collector runs in-cluster.

**App instrumentation (same regardless of backend location):**
- Add **`prom-client`** to every Node service; expose `GET /metrics`.
- Emit **RED metrics**: request **R**ate, **E**rror rate, request **D**uration (histogram) —
  labeled by route + status. Plus default Node process metrics (event loop, heap, GC).

**Collection & shipping:**
- Deploy **Grafana Alloy** (the agent; ~50–80 Mi) as a single pod in k3s.
- Alloy scrapes each service's `/metrics` (via k8s service discovery) and **remote-writes** to
  Grafana Cloud's hosted Prometheus using `GRAFANA_CLOUD_URL` + `GRAFANA_CLOUD_API_KEY`.
- Node/container metrics: enable Alloy's built-in `node_exporter` + cAdvisor integrations (cheap)
  so you also get CPU/RAM/pod dashboards — useful for *proving* the t3.micro headroom story.

**Dashboards to build in Grafana Cloud:**
- Per-service RED (rate/errors/latency p50-p95-p99).
- Cluster/node resource usage (RAM is the interesting one on a 1 GB node).
- Optional alert: error-rate spike or a pod restart loop.

> Why hosted, not in-cluster? A self-hosted Prometheus+Grafana stack (~400–700 Mi) doesn't fit
> the free `t3.micro`. Grafana Cloud keeps us free *and* light while still demonstrating real
> dashboards. Interview line: "I offloaded the metrics backend to keep the node within free-tier
> RAM, running only a scraping agent — a deliberate cost/observability tradeoff."

---

## 11. CI/CD (GitHub Actions)

Single workflow `.github/workflows/ci-cd.yml`, triggered on push to `main`:

1. **Detect changes** — `dorny/paths-filter` to find which `services/*` changed
   (matrix builds only what changed → saves Actions minutes).
2. **Test/Lint** — per changed service (`npm ci`, `npm test`/lint).
3. **Build & push** — `docker/build-push-action` → `ghcr.io/<you>/<service>:<git-sha>` (+ `latest`).
4. **Deploy** — SSH into EC2 (key in repo secret `EC2_SSH_KEY`) and
   `kubectl set image deployment/<svc> <svc>=ghcr.io/...:<sha>` (rolling update).

Secrets used: `GHCR_TOKEN` (or `GITHUB_TOKEN`), `EC2_HOST`, `EC2_SSH_KEY`.
Keep everything **public** where possible so Actions minutes and GHCR stay free.

> Deploy is over SSH (not a cloud-native GitOps flow) because we chose "minimal AWS." It's
> simple and demonstrably works; ArgoCD/GitOps is a noted future upgrade.

---

## 12. Phased execution roadmap

Each phase is independently demoable (strangler-fig — the app stays runnable throughout).

| Phase | Deliverable | Demo checkpoint |
|---|---|---|
| **1. Prep monolith** | JWT replaces sessions; add `ownerUsername`/`authorUsername`; move reviews out of listing doc; fix flagged bugs | Monolith still works, now JWT-based |
| **2. Extract user-service** | user-service + gateway skeleton proxying auth | Signup/login flow through gateway |
| **3. Extract listing + review** | both domain services, sync cascade-delete | Full CRUD across services locally |
| **4. Gateway aggregation + frontend** | EJS moved to gateway, show-page aggregation | UI identical to original, microservice-backed |
| **5. Dockerize** | Dockerfiles + docker-compose | `docker compose up` runs whole system |
| **6. k3s on EC2** | manifests, ingress, secrets, node bootstrap | **Live on the internet** via Elastic IP |
| **7. CI/CD** | GitHub Actions build→push→deploy | Push to `main` auto-deploys |
| **8. Monitoring** | `prom-client` `/metrics` per service (add in Phase 1); Alloy agent + Grafana Cloud dashboards | Live RED + resource dashboards |

> Instrumentation (`/metrics` endpoints) is cheap and gets added during **Phase 1** so every
> service is observable from birth; the Alloy agent + dashboards are wired up in **Phase 8**
> after the cluster is live.

---

## 13. Bug fixes folded into Phase 1

From the initial code read, fix while refactoring (don't carry these into services):
- `schema.js`: `image` validated as body string but arrives as a multipart file → remove/realign.
- `controllers/listing.js` `showListing`/`editListing`: missing `return` after redirect on "not found" → continues and can throw.
- `controllers/user.js` `doSignup`/`doLogout`: reference `next` but it isn't a parameter → `ReferenceError`.
- `app.js`: `cookie.expires` computed once at boot (moot after moving to JWT).
- Mongoose vs Joi `required` mismatches → tighten model schemas per service.

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 1 GB RAM node thrashes | swap + tight limits; upgrade to `t3.small` if needed (one line) |
| Orphaned reviews on failed cascade | isolated `cascadeDelete()` seam; document as known tradeoff / future broker |
| Atlas 512 MB cap | demo-scale data only; fine for portfolio |
| Actions minutes | public repo (unlimited) + path-filtered builds |
| Accidental AWS charges | billing alarm at $5; stop instance between demos |
| Secret leakage | k8s Secrets + repo Secrets; `secrets.example.yaml` placeholders only |

---

## 15. Interview talking points (why each choice)

- **Why microservices for a small app?** Honest: to demonstrate the pattern; boundaries here are
  genuinely clean (users/listings/reviews), so it's a reasonable teaching example, not a forced one.
- **Why JWT over sessions?** Stateless services can't share a session store cleanly.
- **Why denormalize usernames?** Avoids N+1 cross-service calls under REST-only aggregation —
  a classic consistency-vs-coupling tradeoff.
- **Why REST-only, not a broker?** Simplicity; the cascade-delete weakness is acknowledged and
  the seam to add events is in place.
- **Why k3s on EC2, not EKS?** Same k8s skills, ~$73/mo cheaper control plane; right call for a
  portfolio.
- **Why database-per-service on one Atlas cluster?** Isolation enforced by credentials; free tier
  fits; honest about physical vs logical separation.
- **Why Grafana Cloud, not self-hosted Prometheus?** Self-hosted stack won't fit the 1 GB node;
  offloading the backend and running only a scraping agent is a deliberate observability-vs-RAM
  tradeoff that keeps the whole system free.

---

*End of plan. Awaiting approval to begin Phase 1.*
