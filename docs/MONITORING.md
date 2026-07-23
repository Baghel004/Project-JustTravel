# Phase 8 — Monitoring with Grafana Cloud

The app already exposes Prometheus metrics at `/metrics` on every service (added back in Phase 1).
Phase 8 ships those to **Grafana Cloud** (hosted Prometheus + Grafana, free tier) using a small
**Grafana Alloy** agent running in the cluster — so the 1 GB node stays light while the dashboards
live in the cloud.

```
[user/listing/review/api-gateway] --/metrics--> [Alloy agent] --remote_write--> Grafana Cloud
        (in-cluster)                              (in-cluster)                    (hosted dashboards)
```

## 1. 🌐 Create a Grafana Cloud account + get credentials
1. Sign up at **grafana.com** → create a free stack.
2. **Connections → Add new connection → "Hosted Prometheus metrics" (via remote_write / Alloy)**.
   Note three things:
   - **Remote write endpoint** — a URL ending in `/api/prom/push`
   - **Username / Instance ID** — a number
   - **Password / API token** — create an **Access Policy token** with scope **`metrics:write`**
     (starts with `glc_...`)

## 2. ☁️ Create the secret + deploy Alloy (on the EC2 box)
```bash
cd ~/Project-JustTravel
git pull                       # get the k8s/monitoring/ manifests

cp k8s/monitoring/grafana-secret.example.yaml k8s/monitoring/grafana-secret.yaml
nano k8s/monitoring/grafana-secret.yaml   # paste the 3 values from step 1

kubectl apply -f k8s/monitoring/grafana-secret.yaml
kubectl apply -f k8s/monitoring/alloy.yaml

kubectl -n wanderlust rollout status deploy/alloy
kubectl -n wanderlust logs deploy/alloy | tail -20   # should show it scraping + writing
```

## 3. 🌐 Verify metrics are flowing
In Grafana Cloud → **Explore** → pick your Prometheus data source → run:
```promql
http_request_duration_seconds_count
```
You should see series labeled `service="api-gateway"`, `"user-service"`, etc.

## 4. Build the RED dashboard
Import `docs/grafana-dashboard.json` (Grafana → Dashboards → New → Import → Upload JSON), or build
panels from these queries (the **RED** method — Rate, Errors, Duration):

- **Request rate / service**
  ```promql
  sum by (service) (rate(http_request_duration_seconds_count[5m]))
  ```
- **Error rate (5xx) / service**
  ```promql
  sum by (service) (rate(http_request_duration_seconds_count{status=~"5.."}[5m]))
  ```
- **p95 latency / service**
  ```promql
  histogram_quantile(0.95, sum by (le, service) (rate(http_request_duration_seconds_bucket[5m])))
  ```
- **Node/process memory** (the interesting one on a 1 GB box)
  ```promql
  sum by (service) (nodejs_heap_size_used_bytes)
  ```

## Notes
- Alloy pushes **outbound** to Grafana Cloud — no inbound firewall/Atlas changes needed.
- Free tier: 10k active series, 14-day retention — plenty for four small services.
- On the `t3.micro`, Alloy (~64–128 Mi) is the last pod added; if the node gets tight this is where
  the 2 GB swap earns its keep (or bump to `t3.small`).
- Deploying Alloy is a one-time manual step (it's infra, not app code, so it's outside the CI/CD
  path that redeploys the four services).
