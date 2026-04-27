# FictionForge Git Workflow

## Branch Strategy

```
main     ──●────────────────●─────  production (deployed)
            \                /
develop  ───●──●──●──●──●──●─────  QA / integration
                |  |  |  |
feature/xxx ───●──●     ●────────  individual features
bugfix/xxx ──────────●───────────  bug fixes
```

### Branches

| Branch | Purpose | Deploys? |
|--------|---------|----------|
| `main` | Production code | Yes — auto-deploys on push |
| `develop` | Integration / QA | No — for testing only |
| `feature/*` | New features | No — merge into `develop` |
| `bugfix/*` | Bug fixes | No — merge into `develop` |
| `hotfix/*` | Urgent production fixes | Yes — merge into both `main` and `develop` |

## Workflow

### 1. Start New Work

```bash
# Make sure develop is up to date
git checkout develop
git pull origin develop

# Create a feature branch
git checkout -b feature/my-new-feature

# ... do work, commit ...
```

### 2. Open Pull Request

- Open a PR **targeting `develop`**
- Fill out the PR template
- CI will run automatically (frontend type-check + build, backend syntax check)
- Require at least 1 review approval before merging

### 3. Merge to Develop

- Use **Squash and Merge** for clean history
- Delete the feature branch after merge

### 4. Promote to Production

When `develop` is stable and tested:

```bash
# Create a release PR from develop → main
git checkout develop
git pull origin develop
git checkout -b release/v1.x.x

# Open PR targeting main
# After review and approval, merge
```

- Use **Merge Commit** (not squash) for `develop` → `main` to preserve feature history
- The `deploy-production.yml` workflow runs automatically on every `main` push

### 5. Hotfixes (urgent production fixes)

```bash
# Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# ... fix, commit, open PR to main ...
# After merging to main, cherry-pick or merge the same fix into develop
```

## CI/CD Pipelines

### `ci.yml` — Continuous Integration
- Triggers on: pushes to `develop`/`main`, all pull requests
- Frontend: `npm ci` → TypeScript check → `npm run build`
- Backend: create venv → install deps → Python syntax compile check

### `deploy-production.yml` — Production Deploy
- Triggers on: push to `main` only
- Builds frontend, then runs deploy step (configure with your hosting provider)

## GitHub Setup Checklist

After pushing to GitHub, configure these branch protection rules:

### `main` branch
- [ ] Require pull request reviews before merging (1 approval)
- [ ] Require status checks to pass before merging (CI)
- [ ] Require branches to be up to date before merging
- [ ] Restrict pushes that create files larger than 100MB
- [ ] Do not allow bypassing the above settings

### `develop` branch
- [ ] Require pull request reviews before merging (1 approval)
- [ ] Require status checks to pass before merging (CI)
- [ ] Allow force pushes: No

## Connecting to Your GitHub Repo

```bash
# Add your GitHub remote
git remote add origin https://github.com/DrJoeSweeney/writeforge.git

# Push branches
git push -u origin main
git push -u origin develop
```
