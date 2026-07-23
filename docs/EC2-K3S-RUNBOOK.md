# Phase 6 Runbook — Deploy Wanderlust to k3s on AWS EC2

Step-by-step to run the whole microservices stack on a single-node **k3s** cluster on a **free-tier
EC2** instance, behind an **nginx ingress**, pulling images from **GHCR**.

> **Cost warning.** This is the first phase that can cost money. A `t3.micro` is free-tier
> eligible (750 hrs/mo for 12 months) but has only **1 GB RAM** — tight for k3s + 5 pods, so we
> add swap. **Set an AWS billing alarm at $5**, and **stop the instance when you're not demoing**
> (you keep the EBS disk + Elastic IP). If pods keep getting OOM-killed, resize to `t3.small`
> (~$15/mo) — a one-line instance-type change.

Legend: 🖥️ = run on your **local machine**, ☁️ = run **on the EC2 instance** (over SSH).

---

## 0. Prerequisites
- The repo cloned locally with Docker working (used in Phase 5).
- Your three MongoDB Atlas databases (`wanderlust_users`, `wanderlust_listings`, `wanderlust_reviews`).
- Mapbox token + Cloudinary keys.
- A GitHub account (for GHCR). Replace `baghel004` below if your GHCR namespace differs
  (it's your GitHub username, **lowercase**).

---

## 1. 🖥️ Build & push images to GHCR

The k8s manifests pull `ghcr.io/baghel004/wanderlust-<service>:latest`. Push them once (Phase 7
will automate this):

```bash
# a) Login to GHCR with a Personal Access Token (classic) that has: write:packages
#    GitHub → Settings → Developer settings → Tokens (classic) → generate.
echo "<YOUR_GHCR_PAT>" | docker login ghcr.io -u baghel004 --password-stdin

# b) Build, tag and push each service (run from repo root)
for s in api-gateway user-service listing-service review-service; do
  docker build -t ghcr.io/baghel004/wanderlust-$s:latest ./services/$s
  docker push ghcr.io/baghel004/wanderlust-$s:latest
done
```

**c) Make the 4 packages public** (so k3s can pull without a secret):
GitHub → your profile → **Packages** → each `wanderlust-*` → **Package settings** → **Change
visibility → Public**. (Alternative: keep them private and add an `imagePullSecret` — see
Troubleshooting.)

---

## 2. ☁️ Launch the EC2 instance (AWS Console)

1. **EC2 → Launch instance**
   - Name: `wanderlust-k3s`
   - AMI: **Amazon Linux 2023**
   - Type: **t3.micro** (free tier)
   - Key pair: create/download one (e.g. `wanderlust-key.pem`)
   - Storage: **30 GB gp3**
2. **Security group** (inbound rules):
   - SSH `22` — **Source: My IP** (not 0.0.0.0/0)
   - HTTP `80` — `0.0.0.0/0`
   - HTTPS `443` — `0.0.0.0/0`
3. Launch. Then **Elastic IP → Allocate → Associate** with this instance (stable public IP that
   survives reboots; free while attached to a running instance).
4. **Billing alarm:** Billing → Budgets → create a $5 alarm.

SSH in (from the folder holding your key):
```bash
chmod 400 wanderlust-key.pem
ssh -i wanderlust-key.pem ec2-user@<ELASTIC_IP>
```

---

## 3. ☁️ System prep (swap — the 1 GB RAM mitigation)

```bash
# 2 GB swap file
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # confirm swap is active
sudo dnf update -y
```

---

## 4. ☁️ Install k3s (no Traefik) + nginx ingress

```bash
# k3s, with the bundled Traefik disabled (we use nginx, per the plan)
curl -sfL https://get.k3s.io | sh -s - --disable traefik --write-kubeconfig-mode 644

# make kubectl work for ec2-user
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown ec2-user:ec2-user ~/.kube/config
export KUBECONFIG=~/.kube/config
kubectl get nodes            # node should be Ready

# nginx ingress controller (k3s ServiceLB exposes it on host :80/:443)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=180s
```

---

## 5. ☁️ Deploy the app

```bash
# get the manifests onto the box
sudo dnf install -y git
git clone https://github.com/Baghel004/Project-JustTravel.git
cd Project-JustTravel

# create the real secret from the template, fill in your values, then apply it
cp k8s/secret.example.yaml k8s/secret.yaml
nano k8s/secret.yaml        # paste JWT_SECRET, the 3 Atlas URLs, MAP_TOKEN, CLOUD_*

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/user-service.yaml
kubectl apply -f k8s/review-service.yaml
kubectl apply -f k8s/listing-service.yaml
kubectl apply -f k8s/api-gateway.yaml

# watch them come up (Ctrl-C when all are Running/Ready)
kubectl -n wanderlust get pods -w
```

Give the Atlas **Network Access** list your instance's Elastic IP (or `0.0.0.0/0` for the demo)
so the pods can connect.

---

## 6. ☁️/🖥️ Verify

```bash
# on the box
kubectl -n wanderlust get pods,svc,ingress
curl -s localhost/health          # gateway health via ingress
```
Then from your **browser**: `http://<ELASTIC_IP>/` — you should see Wanderlust, and be able to
sign up, create a listing (image upload + map), and leave a review. 🎉

---

## 7. Cost hygiene
- **Stop the instance** when idle: EC2 → Instances → Stop (keeps EBS + Elastic IP; near-zero cost).
- Start it again before a demo; the Elastic IP stays the same.
- Delete everything when done: terminate instance, release Elastic IP, delete EBS.

---

## Troubleshooting
- **Pods `Pending` / OOMKilled** → RAM pressure. Confirm swap is on (`free -h`). If it persists,
  resize the instance to `t3.small` (stop → change instance type → start).
- **`ImagePullBackOff`** → the GHCR packages aren't public. Either make them public (Step 1c), or
  create a pull secret and reference it:
  ```bash
  kubectl -n wanderlust create secret docker-registry ghcr \
    --docker-server=ghcr.io --docker-username=baghel004 --docker-password=<PAT>
  # then add `imagePullSecrets: [{name: ghcr}]` to each Deployment's pod spec
  ```
- **502 from ingress** → a pod isn't Ready yet; `kubectl -n wanderlust get pods` and
  `kubectl -n wanderlust logs deploy/api-gateway`.
- **k3s won't start with swap** → k3s tolerates swap by default; if the kubelet complains, add
  `--kubelet-arg=fail-swap-on=false` to the k3s install command.
- **Redeploy after a new image push** → `kubectl -n wanderlust rollout restart deploy/<name>`
  (images are `:latest` with `imagePullPolicy: Always`). Phase 7 automates this.

---

## What Phase 6 leaves for later
- **HTTPS** (currently HTTP only) — add cert-manager + Let's Encrypt with a real domain later.
- **CI/CD** (Phase 7) — automate build → push → `rollout restart` from GitHub Actions.
- **Monitoring** (Phase 8) — Grafana Alloy agent scraping each `/metrics`.
