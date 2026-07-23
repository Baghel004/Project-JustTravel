# Phase 7 — CI/CD (GitHub Actions → GHCR → k3s)

`.github/workflows/ci-cd.yml` builds and deploys automatically on every push to `main` that
touches `services/**`.

## Pipeline

```
push to main (services/** changed)
        │
   ┌────▼─────┐   detect which services changed (dorny/paths-filter)
   │ changes  │   → JSON list for the build matrix
   └────┬─────┘
        │  (only changed services; a manual run builds all)
   ┌────▼─────┐   per service, in parallel:
   │  build   │   npm test → syntax check → docker build → push to GHCR
   └────┬─────┘   tags: :latest and :<git-sha>   (layer cache via GHA)
        │
   ┌────▼─────┐   SSH to the EC2 box and, per changed service:
   │  deploy  │   kubectl -n wanderlust set image deployment/<svc> ...:<sha>
   └──────────┘   kubectl rollout status   (rolling update)
```

**Path-filtering** means editing only `review-service` rebuilds/redeploys only that one — saving
Actions minutes and deploy time. A manual **Run workflow** (workflow_dispatch) builds all four.

## Required GitHub repository secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `EC2_HOST` | Elastic IP (or DNS) of the k3s EC2 instance |
| `EC2_SSH_KEY` | **contents** of the private key `.pem` used to SSH as `ec2-user` |

`GITHUB_TOKEN` is provided automatically and is used (with `packages: write`) to push images to
GHCR — no PAT needed in CI. The workflow pushes to `ghcr.io/<owner>/wanderlust-<service>` where
`<owner>` is your lowercased GitHub username.

## Prerequisites (from Phase 6)
- The k3s cluster is already provisioned and the app deployed once (the Deployments must exist for
  `kubectl set image` to target).
- The GHCR packages are **public** (or an `imagePullSecret` is configured) so k3s can pull.

## First run / notes
- The deploy step assumes `kubectl` on the box reads `/etc/rancher/k3s/k3s.yaml` (k3s default).
- Because images are also tagged `:latest` with `imagePullPolicy: Always`, a manual
  `kubectl -n wanderlust rollout restart deployment/<svc>` also works if you ever deploy out-of-band.
- Future hardening: real unit tests in the `build` job; GitOps (ArgoCD) instead of SSH; HTTPS.
