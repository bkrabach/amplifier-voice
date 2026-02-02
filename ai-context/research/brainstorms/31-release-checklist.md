# Release Checklist: Amplifier Voice System

> **Version**: 1.0.0  
> **Date**: 2026-01-31  
> **Status**: Production Release Guide  
> **Purpose**: Step-by-step checklist for safe deployment of the voice system

---

## Quick Reference: Release Severity Levels

| Level | Description | Approval Required | Rollback Window |
|-------|-------------|-------------------|-----------------|
| **Hotfix** | Critical bug fix, security patch | Tech Lead | 15 minutes |
| **Minor** | Bug fixes, small features | Tech Lead + QA | 1 hour |
| **Major** | New features, breaking changes | Tech Lead + QA + Product | 4 hours |
| **Infrastructure** | Database, network, scaling changes | All + Ops | 24 hours |

---

## Phase 1: Pre-Release Verification

### 1.1 Code Quality Gates

| Check | Command | Pass Criteria | Owner |
|-------|---------|---------------|-------|
| [ ] Unit tests pass | `pytest voice-server/tests/` | 100% pass rate | Dev |
| [ ] Integration tests pass | `pytest voice-server/tests/integration/` | 100% pass rate | Dev |
| [ ] Type checking | `pyright voice-server/` | No errors | Dev |
| [ ] Linting | `ruff check voice-server/` | No errors | Dev |
| [ ] Client build | `cd voice-client && npm run build` | No errors | Dev |
| [ ] Client lint | `cd voice-client && npm run lint` | No warnings | Dev |

```bash
# Quick validation script
#!/bin/bash
set -e
echo "=== Running Pre-Release Checks ==="

cd voice-server
echo ">>> Python checks..."
uv run pytest tests/ -v
uv run pyright .
uv run ruff check .

cd ../voice-client
echo ">>> Client checks..."
npm run lint
npm run build

echo "=== All checks passed ==="
```

### 1.2 Security Verification

| Check | Verification Method | Pass Criteria |
|-------|---------------------|---------------|
| [ ] No secrets in code | `git secrets --scan` | No findings |
| [ ] Dependencies audited | `pip-audit` / `npm audit` | No critical vulns |
| [ ] API key rotation | Check last rotation date | < 90 days |
| [ ] TLS certificates | Check expiry | > 30 days remaining |
| [ ] CORS configuration | Review `allowed_origins` | Production domains only |

**Security Checklist:**
```
[ ] OPENAI_API_KEY not in repository
[ ] ANTHROPIC_API_KEY not in repository
[ ] .env files in .gitignore
[ ] No hardcoded credentials
[ ] Rate limiting configured
[ ] Input validation in place
[ ] Command blocklist active (rm -rf, sudo, etc.)
```

### 1.3 Functional Testing

#### Voice System Tests (Critical Path)

| Test ID | Test Case | Status |
|---------|-----------|--------|
| [ ] CON-001 | WebRTC connection establishes | |
| [ ] CON-020 | Reconnection after network drop | |
| [ ] AUD-001 | Microphone permission and capture | |
| [ ] AUD-010 | Echo cancellation active | |
| [ ] CONV-001 | Basic turn-taking works | |
| [ ] CONV-010 | Interruption handling | |
| [ ] TOOL-001 | File read via voice | |
| [ ] TOOL-009 | Task delegation to Amplifier | |

#### Manual Smoke Test Script

```markdown
1. Open application in Chrome
2. Click "Start Voice Session"
3. Grant microphone permission
4. Say: "Hello, can you hear me?"
   Expected: AI responds conversationally
   
5. Say: "What files are in this directory?"
   Expected: AI uses glob/task tool, reports results
   
6. Interrupt AI mid-response
   Expected: AI stops immediately, listens
   
7. Say: "Read the README file"
   Expected: AI reads file, summarizes content
   
8. Wait 2 minutes idle
   Expected: Session remains connected
   
9. Disconnect network, reconnect
   Expected: Automatic reconnection
   
10. End session
    Expected: Clean disconnect, no errors
```

### 1.4 Performance Baseline

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| [ ] TTFA (P50) | < 400ms | ___ ms | |
| [ ] TTFA (P95) | < 800ms | ___ ms | |
| [ ] Session creation | < 300ms | ___ ms | |
| [ ] SDP exchange | < 400ms | ___ ms | |
| [ ] Tool execution (avg) | < 5s | ___ s | |
| [ ] Memory usage | < 512MB | ___ MB | |
| [ ] CPU usage (idle) | < 5% | ___ % | |

### 1.5 Documentation Review

| Document | Reviewed | Up to Date |
|----------|----------|------------|
| [ ] ARCHITECTURE.md | | |
| [ ] SETUP.md | | |
| [ ] QUICKSTART.md | | |
| [ ] API endpoints documented | | |
| [ ] Environment variables documented | | |
| [ ] Changelog updated | | |
| [ ] Version bumped | | |

---

## Phase 2: Environment Preparation

### 2.1 Infrastructure Readiness

#### Production Environment

| Component | Check | Status |
|-----------|-------|--------|
| [ ] Voice Server instances | Min 2 replicas ready | |
| [ ] Load balancer | Health checks configured | |
| [ ] Database (PostgreSQL) | Connection pool sized | |
| [ ] Cache (Redis) | Cluster healthy | |
| [ ] CDN | Static assets deployed | |
| [ ] DNS | Records verified | |

#### Resource Verification

```bash
# Verify infrastructure
kubectl get pods -n voice-production
kubectl get services -n voice-production
kubectl top pods -n voice-production

# Check database connections
psql -h $DB_HOST -U $DB_USER -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
redis-cli -h $REDIS_HOST ping
redis-cli -h $REDIS_HOST info memory
```

### 2.2 Configuration Verification

#### Environment Variables

| Variable | Set | Validated |
|----------|-----|-----------|
| [ ] `OPENAI_API_KEY` | | |
| [ ] `ANTHROPIC_API_KEY` | | |
| [ ] `AMPLIFIER_BUNDLE` | | |
| [ ] `AMPLIFIER_CWD` | | |
| [ ] `AMPLIFIER_AUTO_APPROVE` | | |
| [ ] `DATABASE_URL` | | |
| [ ] `REDIS_URL` | | |
| [ ] `LOG_LEVEL` | | |

#### Configuration Diff

```bash
# Compare staging vs production config
diff <(kubectl get configmap voice-config -n voice-staging -o yaml) \
     <(kubectl get configmap voice-config -n voice-production -o yaml)

# Verify secrets exist (not values)
kubectl get secrets -n voice-production | grep -E "(openai|anthropic|db)"
```

### 2.3 Network Verification

| Check | Command | Expected |
|-------|---------|----------|
| [ ] OpenAI reachable | `curl -I https://api.openai.com` | 200 OK |
| [ ] WebRTC ports open | `nc -zv api.openai.com 443` | Connection succeeded |
| [ ] Internal services | Service mesh healthy | All green |
| [ ] CORS headers | Check preflight response | Correct origins |

### 2.4 Monitoring Setup

| System | Configured | Alerting |
|--------|------------|----------|
| [ ] Prometheus metrics | `/metrics` endpoint active | |
| [ ] Grafana dashboards | Voice system dashboard | |
| [ ] Log aggregation | Logs flowing to central | |
| [ ] Error tracking | Sentry/equivalent ready | |
| [ ] Uptime monitoring | External health check | |

#### Alert Thresholds Configured

```yaml
# Critical alerts that must be active
alerts:
  - name: VoiceServerDown
    condition: up{job="voice-server"} == 0
    severity: critical
    
  - name: HighErrorRate
    condition: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    severity: critical
    
  - name: HighLatency
    condition: histogram_quantile(0.95, voice_ttfa_seconds) > 2
    severity: warning
    
  - name: SessionsNearCapacity
    condition: voice_active_sessions / voice_max_sessions > 0.8
    severity: warning
```

---

## Phase 3: Deployment Steps

### 3.1 Pre-Deployment

**T-30 minutes:**

| Task | Owner | Status |
|------|-------|--------|
| [ ] Notify stakeholders of deployment window | Release Manager | |
| [ ] Confirm on-call engineer availability | Ops | |
| [ ] Open incident channel | Release Manager | |
| [ ] Verify rollback procedure documented | Dev | |
| [ ] Take database backup (if applicable) | DBA | |

**Communication Template:**
```
Subject: [Voice System] Deployment Starting - v{VERSION}

Team,

We're beginning deployment of Amplifier Voice v{VERSION}.

Deployment Window: {START_TIME} - {END_TIME}
Expected Duration: {DURATION}
Risk Level: {LEVEL}

Key Changes:
- {CHANGE_1}
- {CHANGE_2}

On-call: {ENGINEER_NAME} ({CONTACT})

Updates will be posted in #voice-releases.
```

### 3.2 Deployment Execution

#### Step 1: Deploy to Canary (5% traffic)

```bash
# Deploy canary
kubectl set image deployment/voice-server-canary \
  voice-server=voice-server:${VERSION} \
  -n voice-production

# Wait for rollout
kubectl rollout status deployment/voice-server-canary -n voice-production

# Verify canary health
kubectl logs -l app=voice-server,track=canary -n voice-production --tail=50
```

**Canary Validation (10 minutes):**

| Check | Status |
|-------|--------|
| [ ] No error spikes in canary logs | |
| [ ] Latency within baseline | |
| [ ] WebRTC connections successful | |
| [ ] Tool execution working | |

#### Step 2: Progressive Rollout

```bash
# 25% rollout
kubectl scale deployment/voice-server --replicas=3 -n voice-production
kubectl set image deployment/voice-server \
  voice-server=voice-server:${VERSION} \
  -n voice-production

# Wait and validate (5 minutes)
# Check metrics dashboard

# 50% rollout
kubectl scale deployment/voice-server --replicas=6 -n voice-production

# Wait and validate (5 minutes)

# 100% rollout
kubectl scale deployment/voice-server --replicas=12 -n voice-production
```

#### Step 3: Client Deployment

```bash
# Build production client
cd voice-client
npm run build

# Deploy to CDN
aws s3 sync dist/ s3://voice-client-bucket/ --delete

# Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST_ID} \
  --paths "/*"
```

### 3.3 Deployment Verification

| Check | Command/Method | Pass Criteria |
|-------|----------------|---------------|
| [ ] All pods healthy | `kubectl get pods` | All Running |
| [ ] Health endpoint | `curl /health` | 200 OK |
| [ ] Version correct | `curl /health \| jq .version` | Matches release |
| [ ] Metrics flowing | Grafana dashboard | Data updating |
| [ ] No error spike | Error rate graph | < baseline |

---

## Phase 4: Post-Deployment Validation

### 4.1 Immediate Validation (0-15 minutes)

| Test | Method | Status |
|------|--------|--------|
| [ ] Session creation works | API call | |
| [ ] WebRTC connection succeeds | Manual test | |
| [ ] Voice input/output works | Manual test | |
| [ ] Tool execution succeeds | Voice command | |
| [ ] Error rate normal | Metrics check | |
| [ ] Latency normal | Metrics check | |

**Validation Script:**
```bash
#!/bin/bash
echo "=== Post-Deployment Validation ==="

# Health check
echo ">>> Health endpoint..."
curl -s https://voice.example.com/health | jq .

# Session creation
echo ">>> Session creation..."
RESPONSE=$(curl -s https://voice.example.com/session)
echo $RESPONSE | jq .client_secret | head -c 20
echo "..."

# Metrics
echo ">>> Active sessions..."
curl -s https://voice.example.com/metrics | grep voice_active_sessions

echo "=== Validation Complete ==="
```

### 4.2 Extended Validation (15-60 minutes)

| Metric | Threshold | Actual | Status |
|--------|-----------|--------|--------|
| [ ] Error rate | < 0.1% | | |
| [ ] TTFA P95 | < 800ms | | |
| [ ] Session success rate | > 99% | | |
| [ ] Memory growth | < 10% | | |
| [ ] CPU usage | < 70% | | |

### 4.3 User Experience Validation

| Scenario | Tester | Result |
|----------|--------|--------|
| [ ] New user onboarding flow | QA | |
| [ ] Extended conversation (5 min) | QA | |
| [ ] Tool-heavy workflow | QA | |
| [ ] Mobile browser (iOS Safari) | QA | |
| [ ] Mobile browser (Android Chrome) | QA | |
| [ ] Poor network conditions | QA | |

### 4.4 Success Criteria

**Deployment is successful when:**

```
[ ] All pods healthy for 30+ minutes
[ ] Error rate < 0.1% (or baseline)
[ ] Latency within 10% of baseline
[ ] No critical alerts fired
[ ] User-facing functionality verified
[ ] No rollback triggers observed
```

---

## Phase 5: Rollback Procedures

### 5.1 Rollback Triggers

**Immediate Rollback (no approval needed):**
- Error rate > 5%
- Session creation failure rate > 10%
- P95 latency > 3x baseline
- Critical security vulnerability discovered
- Complete service outage

**Considered Rollback (Tech Lead approval):**
- Error rate > 1% sustained 15+ minutes
- User complaints increasing significantly
- Latency regression > 50%
- Partial functionality failure

### 5.2 Rollback Steps

#### Server Rollback

```bash
# Identify previous version
PREV_VERSION=$(kubectl get deployment voice-server -n voice-production \
  -o jsonpath='{.metadata.annotations.previous-version}')

# Rollback deployment
kubectl rollout undo deployment/voice-server -n voice-production

# Or rollback to specific version
kubectl set image deployment/voice-server \
  voice-server=voice-server:${PREV_VERSION} \
  -n voice-production

# Verify rollback
kubectl rollout status deployment/voice-server -n voice-production
```

#### Client Rollback

```bash
# Restore previous client version from backup
aws s3 sync s3://voice-client-backup/${PREV_VERSION}/ s3://voice-client-bucket/ --delete

# Invalidate CDN
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST_ID} \
  --paths "/*"
```

#### Database Rollback (if schema changes)

```bash
# Only if database migration was part of release
# This requires downtime planning

# 1. Scale down services
kubectl scale deployment/voice-server --replicas=0 -n voice-production

# 2. Restore database backup
pg_restore -h $DB_HOST -U $DB_USER -d voice_production backup_${TIMESTAMP}.dump

# 3. Deploy previous server version
kubectl set image deployment/voice-server \
  voice-server=voice-server:${PREV_VERSION} \
  -n voice-production

# 4. Scale up
kubectl scale deployment/voice-server --replicas=12 -n voice-production
```

### 5.3 Post-Rollback Verification

| Check | Status |
|-------|--------|
| [ ] All pods healthy | |
| [ ] Error rate normalized | |
| [ ] Latency normalized | |
| [ ] User functionality restored | |
| [ ] Incident documented | |

---

## Phase 6: Communication Plan

### 6.1 Stakeholder Notification Matrix

| Event | Notify | Channel | Template |
|-------|--------|---------|----------|
| Deployment starting | Engineering | #voice-releases | DEPLOY_START |
| Deployment complete | Engineering + Product | #voice-releases | DEPLOY_SUCCESS |
| Issue detected | Engineering + Ops | #voice-incidents | ISSUE_DETECTED |
| Rollback initiated | All stakeholders | #voice-incidents + Email | ROLLBACK_START |
| Rollback complete | All stakeholders | #voice-incidents + Email | ROLLBACK_COMPLETE |
| Post-mortem scheduled | Engineering | #voice-engineering | POSTMORTEM |

### 6.2 Communication Templates

#### DEPLOY_START
```
:rocket: [Voice System] Deployment Starting

Version: v{VERSION}
Started: {TIMESTAMP}
Expected Duration: {DURATION}
Release Manager: {NAME}

Key Changes:
{CHANGELOG}

Tracking: {JIRA_LINK}
```

#### DEPLOY_SUCCESS
```
:white_check_mark: [Voice System] Deployment Complete

Version: v{VERSION}
Duration: {DURATION}
Status: Successful

Metrics:
- Error rate: {ERROR_RATE}
- P95 Latency: {LATENCY}
- Active sessions: {SESSIONS}

No issues detected. Monitoring continues.
```

#### ISSUE_DETECTED
```
:warning: [Voice System] Issue Detected

Version: v{VERSION}
Issue: {DESCRIPTION}
Severity: {SEVERITY}
Impact: {IMPACT}

Current Status: Investigating
On-call: {ENGINEER}

Updates in #voice-incidents
```

#### ROLLBACK_START
```
:rotating_light: [Voice System] Rollback Initiated

Version: v{VERSION} -> v{PREV_VERSION}
Reason: {REASON}
Started: {TIMESTAMP}
ETA: {ETA}

Status updates every 5 minutes.
```

#### ROLLBACK_COMPLETE
```
:rewind: [Voice System] Rollback Complete

Rolled back: v{VERSION} -> v{PREV_VERSION}
Duration: {DURATION}
Status: Service restored

Impact Summary:
- Duration: {OUTAGE_DURATION}
- Users affected: {AFFECTED_COUNT}

Post-mortem scheduled: {DATE}
```

### 6.3 Escalation Path

```
Level 1 (0-15 min): On-call Engineer
  - Triage issue
  - Attempt quick fix
  - Initiate rollback if needed

Level 2 (15-30 min): Tech Lead
  - Approve rollback
  - Coordinate response
  - Notify stakeholders

Level 3 (30+ min): Engineering Manager
  - External communication
  - Resource allocation
  - Executive notification

Level 4 (Major outage): VP Engineering
  - Customer communication
  - Status page updates
  - Executive briefing
```

---

## Appendix A: Quick Reference Commands

### Health Checks
```bash
# Server health
curl -s https://voice.example.com/health | jq .

# Metrics endpoint
curl -s https://voice.example.com/metrics | head -50

# Active sessions
curl -s https://voice.example.com/metrics | grep active_sessions
```

### Kubernetes Operations
```bash
# Check pods
kubectl get pods -n voice-production -l app=voice-server

# Check logs
kubectl logs -l app=voice-server -n voice-production --tail=100 -f

# Restart pods (rolling)
kubectl rollout restart deployment/voice-server -n voice-production

# Scale
kubectl scale deployment/voice-server --replicas=N -n voice-production
```

### Database Operations
```bash
# Connection check
psql -h $DB_HOST -U $DB_USER -c "SELECT 1;"

# Active connections
psql -h $DB_HOST -U $DB_USER -c "SELECT count(*) FROM pg_stat_activity;"

# Backup
pg_dump -h $DB_HOST -U $DB_USER voice_production > backup_$(date +%Y%m%d_%H%M%S).dump
```

### Redis Operations
```bash
# Health
redis-cli -h $REDIS_HOST ping

# Memory
redis-cli -h $REDIS_HOST info memory

# Flush cache (caution!)
redis-cli -h $REDIS_HOST FLUSHDB
```

---

## Appendix B: Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-31 | Amplifier Team | Initial release checklist |

---

## Appendix C: Sign-Off Sheet

### Release Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Development Lead | | | |
| QA Lead | | | |
| Operations Lead | | | |
| Product Owner | | | |

### Post-Deployment Confirmation

| Check | Confirmed By | Time |
|-------|-------------|------|
| All validation passed | | |
| Monitoring active | | |
| Rollback procedure tested | | |
| Communication sent | | |

---

**Remember**: When in doubt, rollback first, investigate second.
