# Deployment Architecture: Voice + Amplifier System

> **Version**: 1.0.0  
> **Date**: 2026-01-31  
> **Status**: Production Deployment Specification  
> **Classification**: Infrastructure Architecture Documentation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Production Infrastructure](#2-production-infrastructure)
3. [Container Architecture](#3-container-architecture)
4. [Orchestration Patterns](#4-orchestration-patterns)
5. [Scaling Strategies](#5-scaling-strategies)
6. [Load Balancing](#6-load-balancing)
7. [High Availability Patterns](#7-high-availability-patterns)
8. [Monitoring and Alerting](#8-monitoring-and-alerting)
9. [Disaster Recovery](#9-disaster-recovery)
10. [Deployment Checklist](#10-deployment-checklist)

---

## 1. Executive Summary

The Voice + Amplifier deployment architecture must handle the unique challenges of real-time voice AI: persistent WebRTC connections, session affinity requirements, sub-second latency constraints, and tool execution isolation. This document provides production-ready patterns for deploying at scale.

### Key Architectural Principles

| Principle | Implementation |
|-----------|----------------|
| **Session Affinity** | Sticky sessions for WebRTC; stateful connection management |
| **Latency-First** | Edge deployment, regional load balancing, UDP prioritization |
| **Graceful Degradation** | Circuit breakers, fallback paths, load shedding |
| **Observable** | Full telemetry: metrics, logs, traces, audio quality stats |
| **Secure by Default** | Zero-trust networking, encrypted channels, audit logging |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION DEPLOYMENT TOPOLOGY                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐  │
│  │   Clients   │     │   Edge Layer     │     │         Application Layer           │  │
│  │  (Browser)  │     │                  │     │                                     │  │
│  │             │     │  ┌────────────┐  │     │  ┌─────────────┐  ┌─────────────┐  │  │
│  │  ┌───────┐  │     │  │   CDN      │  │     │  │   Voice     │  │  Amplifier  │  │  │
│  │  │ React │◄─┼─────┼─►│  (Static)  │  │     │  │   Server    │  │   Bridge    │  │  │
│  │  │  App  │  │     │  └────────────┘  │     │  │  (FastAPI)  │  │             │  │  │
│  │  └───┬───┘  │     │                  │     │  └──────┬──────┘  └──────┬──────┘  │  │
│  │      │      │     │  ┌────────────┐  │     │         │                │         │  │
│  │      │      │     │  │   Global   │  │     │         └────────┬───────┘         │  │
│  │  WebRTC     │     │  │   Load     │  │     │                  │                 │  │
│  │  Audio      │     │  │  Balancer  │◄─┼─────┼──────────────────┘                 │  │
│  │      │      │     │  └────────────┘  │     │                                     │  │
│  │      │      │     │                  │     └─────────────────────────────────────┘  │
│  │      ▼      │     └──────────────────┘                                              │
│  │  ┌───────┐  │                                                                        │
│  │  │OpenAI │  │     ┌──────────────────┐     ┌─────────────────────────────────────┐  │
│  │  │WebRTC │◄─┼─────┤  OpenAI Cloud    │     │         Data Layer                  │  │
│  │  │Server │  │     │  (gpt-realtime)  │     │                                     │  │
│  │  └───────┘  │     └──────────────────┘     │  ┌─────────┐  ┌─────────┐  ┌─────┐  │  │
│  └─────────────┘                              │  │ Redis   │  │ Postgres│  │ S3  │  │  │
│                                               │  │ (Cache) │  │  (Meta) │  │(Logs│  │  │
│                                               │  └─────────┘  └─────────┘  └─────┘  │  │
│                                               └─────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Production Infrastructure

### 2.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPONENT RESPONSIBILITIES                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  TIER 1: EDGE                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  • CDN (CloudFlare/Fastly): Static assets, React bundle                         │   │
│  │  • DNS (Route53/CloudFlare): Geo-based routing, health checks                   │   │
│  │  • WAF: Rate limiting, DDoS protection, bot detection                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  TIER 2: LOAD BALANCING                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  • L4 Load Balancer: TCP/UDP traffic distribution                               │   │
│  │  • L7 Load Balancer: HTTP/WebSocket routing, SSL termination                    │   │
│  │  • Session Affinity: Cookie/IP-based sticky sessions                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  TIER 3: APPLICATION                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  • Voice Server Pods: FastAPI, session management, SDP exchange                 │   │
│  │  • Amplifier Bridge: Tool execution, Amplifier Foundation integration           │   │
│  │  • Worker Pods: Background tasks, cleanup, analytics                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  TIER 4: DATA                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  • Redis Cluster: Session cache, rate limiting, pub/sub                         │   │
│  │  • PostgreSQL: Conversation history, analytics, audit logs                      │   │
│  │  • Object Storage: Audio recordings, transcripts, artifacts                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Infrastructure Requirements

| Component | Minimum Spec | Recommended | Notes |
|-----------|-------------|-------------|-------|
| **Voice Server** | 2 vCPU, 4GB RAM | 4 vCPU, 8GB RAM | Per pod, async I/O bound |
| **Amplifier Bridge** | 2 vCPU, 4GB RAM | 4 vCPU, 16GB RAM | Tool execution may spike |
| **Redis** | 2 vCPU, 4GB RAM | 4 vCPU, 8GB RAM | Low latency critical |
| **PostgreSQL** | 2 vCPU, 8GB RAM | 4 vCPU, 16GB RAM | Connection pooling |
| **Load Balancer** | Managed service | Managed service | AWS ALB/NLB or equivalent |

### 2.3 Network Requirements

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              NETWORK TOPOLOGY                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  EXTERNAL TRAFFIC                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Inbound:                                                                        │   │
│  │    • 443/tcp   - HTTPS (API, WebSocket upgrade)                                 │   │
│  │    • 443/tcp   - WebRTC TURN fallback                                           │   │
│  │    • 3478/udp  - WebRTC (OpenAI's STUN equivalent)                              │   │
│  │                                                                                  │   │
│  │  Outbound:                                                                       │   │
│  │    • api.openai.com:443     - Realtime API                                      │   │
│  │    • *.azure.com:3478,443   - OpenAI WebRTC endpoints                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  INTERNAL TRAFFIC (Private VPC/Subnet)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │    • 8000/tcp  - Voice Server (FastAPI)                                         │   │
│  │    • 6379/tcp  - Redis                                                          │   │
│  │    • 5432/tcp  - PostgreSQL                                                     │   │
│  │    • 9090/tcp  - Prometheus metrics                                             │   │
│  │    • 4317/tcp  - OpenTelemetry collector                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  FIREWALL RULES                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │    • Deny all by default                                                        │   │
│  │    • Allow listed ports only                                                    │   │
│  │    • Egress: OpenAI endpoints, DNS, NTP only                                    │   │
│  │    • Internal: Service mesh or security groups                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Cloud Provider Deployment Options

| Provider | Compute | Load Balancer | Database | Cache |
|----------|---------|---------------|----------|-------|
| **AWS** | EKS/ECS/Fargate | ALB + NLB | RDS PostgreSQL | ElastiCache |
| **Azure** | AKS | App Gateway | Azure DB | Azure Cache |
| **GCP** | GKE | Cloud Load Balancing | Cloud SQL | Memorystore |
| **Self-hosted** | K8s on bare metal | HAProxy/Nginx | PostgreSQL | Redis |

---

## 3. Container Architecture

### 3.1 Docker Image Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CONTAINER IMAGES                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  IMAGE: voice-server                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Base: python:3.12-slim                                                          │   │
│  │  Size: ~250MB                                                                    │   │
│  │  Layers:                                                                         │   │
│  │    • System deps (libffi, ssl)                                                  │   │
│  │    • Python dependencies (FastAPI, httpx, pydantic)                             │   │
│  │    • Application code                                                            │   │
│  │  Healthcheck: /health endpoint                                                   │   │
│  │  User: non-root (uid=1000)                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  IMAGE: amplifier-bridge                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Base: python:3.12-slim                                                          │   │
│  │  Size: ~400MB (includes Amplifier Foundation)                                    │   │
│  │  Layers:                                                                         │   │
│  │    • System deps (git, build-essential for some tools)                          │   │
│  │    • Amplifier Foundation + bundles                                              │   │
│  │    • Application code                                                            │   │
│  │  Security: Restricted filesystem access, no privileged mode                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  IMAGE: voice-client (for CDN)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Base: nginx:alpine                                                              │   │
│  │  Size: ~30MB                                                                     │   │
│  │  Contents: React build artifacts, nginx config                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Dockerfile Examples

**Voice Server Dockerfile:**

```dockerfile
# voice-server/Dockerfile
FROM python:3.12-slim AS base

# Security: Run as non-root
RUN useradd -m -u 1000 appuser

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=appuser:appuser . .

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

EXPOSE 8000

CMD ["uvicorn", "voice_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.3 Container Resource Limits

```yaml
# Kubernetes resource specifications
resources:
  voice-server:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2000m"
      memory: "2Gi"
  
  amplifier-bridge:
    requests:
      cpu: "1000m"
      memory: "1Gi"
    limits:
      cpu: "4000m"
      memory: "8Gi"  # Tool execution may need burst capacity
```

---

## 4. Orchestration Patterns

### 4.1 Kubernetes Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              KUBERNETES CLUSTER                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  NAMESPACE: voice-production                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  DEPLOYMENT: voice-server                 DEPLOYMENT: amplifier-bridge          │   │
│  │  ┌───────────────────────────────┐       ┌───────────────────────────────┐      │   │
│  │  │ Replicas: 3-10 (HPA)          │       │ Replicas: 2-5 (HPA)           │      │   │
│  │  │ Strategy: RollingUpdate       │       │ Strategy: RollingUpdate       │      │   │
│  │  │ maxSurge: 25%                 │       │ maxSurge: 25%                 │      │   │
│  │  │ maxUnavailable: 0             │       │ maxUnavailable: 0             │      │   │
│  │  │                               │       │                               │      │   │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐     │       │  ┌─────┐ ┌─────┐              │      │   │
│  │  │  │Pod 1│ │Pod 2│ │Pod 3│     │       │  │Pod 1│ │Pod 2│              │      │   │
│  │  │  └─────┘ └─────┘ └─────┘     │       │  └─────┘ └─────┘              │      │   │
│  │  └───────────────────────────────┘       └───────────────────────────────┘      │   │
│  │                                                                                  │   │
│  │  SERVICE: voice-server-svc               SERVICE: amplifier-bridge-svc          │   │
│  │  ┌───────────────────────────────┐       ┌───────────────────────────────┐      │   │
│  │  │ Type: ClusterIP               │       │ Type: ClusterIP               │      │   │
│  │  │ Port: 8000                    │       │ Port: 8001                    │      │   │
│  │  │ Session Affinity: ClientIP    │       │ Session Affinity: None        │      │   │
│  │  └───────────────────────────────┘       └───────────────────────────────┘      │   │
│  │                                                                                  │   │
│  │  INGRESS: voice-ingress                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Class: nginx / aws-alb                                                   │   │   │
│  │  │ TLS: Enabled (cert-manager)                                              │   │   │
│  │  │ Annotations:                                                             │   │   │
│  │  │   • nginx.ingress.kubernetes.io/affinity: "cookie"                      │   │   │
│  │  │   • nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"              │   │   │
│  │  │   • nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"              │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                  │   │
│  │  HPA: voice-server-hpa                   HPA: amplifier-bridge-hpa             │   │
│  │  ┌───────────────────────────────┐       ┌───────────────────────────────┐      │   │
│  │  │ Min: 3, Max: 10               │       │ Min: 2, Max: 5                │      │   │
│  │  │ CPU Target: 70%               │       │ CPU Target: 60%               │      │   │
│  │  │ Memory Target: 80%            │       │ Memory Target: 70%            │      │   │
│  │  │ Scale-up: 15s stabilization   │       │ Scale-up: 30s stabilization   │      │   │
│  │  │ Scale-down: 300s stabilization│       │ Scale-down: 300s stabilization│      │   │
│  │  └───────────────────────────────┘       └───────────────────────────────┘      │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Kubernetes Manifests

**Deployment Example:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voice-server
  namespace: voice-production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: voice-server
  template:
    metadata:
      labels:
        app: voice-server
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
    spec:
      serviceAccountName: voice-server
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: voice-server
        image: voice-server:latest
        ports:
        - containerPort: 8000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: voice-secrets
              key: openai-api-key
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: voice-config
              key: redis-url
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: ScheduleAnyway
        labelSelector:
          matchLabels:
            app: voice-server
```

### 4.3 Alternative: Docker Compose (Development/Small Scale)

```yaml
version: '3.8'

services:
  voice-server:
    build: ./voice-server
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379
      - AMPLIFIER_BRIDGE_URL=http://amplifier-bridge:8001
    depends_on:
      - redis
      - amplifier-bridge
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  amplifier-bridge:
    build: ./amplifier-bridge
    ports:
      - "8001:8001"
    volumes:
      - ./workspace:/workspace:rw
    environment:
      - SESSION_CWD=/workspace
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '4'
          memory: 8G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - voice-server

volumes:
  redis-data:
```

---

## 5. Scaling Strategies

### 5.1 Horizontal vs Vertical Scaling

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SCALING DECISION MATRIX                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  HORIZONTAL SCALING (Scale Out)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Best For:                                                                       │   │
│  │    • Voice Server - stateless request handling                                  │   │
│  │    • More concurrent sessions                                                    │   │
│  │    • Geographic distribution                                                     │   │
│  │                                                                                  │   │
│  │  Pattern:                                                                        │   │
│  │    ┌─────┐  ┌─────┐  ┌─────┐       ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ │   │
│  │    │Pod 1│  │Pod 2│  │Pod 3│  ───► │Pod 1│  │Pod 2│  │Pod 3│  │Pod 4│  │Pod 5│ │   │
│  │    └─────┘  └─────┘  └─────┘       └─────┘  └─────┘  └─────┘  └─────┘  └─────┘ │   │
│  │    (3 pods @ 70% CPU)              (5 pods @ 42% CPU)                          │   │
│  │                                                                                  │   │
│  │  Triggers:                                                                       │   │
│  │    • CPU > 70% for 2 minutes                                                    │   │
│  │    • Active sessions > 80% of capacity                                          │   │
│  │    • Request latency p95 > 200ms                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  VERTICAL SCALING (Scale Up)                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Best For:                                                                       │   │
│  │    • Amplifier Bridge - tool execution memory spikes                            │   │
│  │    • Database - connection limits, query performance                            │   │
│  │    • Redis - dataset size                                                       │   │
│  │                                                                                  │   │
│  │  Pattern:                                                                        │   │
│  │    ┌─────────┐                     ┌───────────────┐                            │   │
│  │    │  2 CPU  │                     │    4 CPU      │                            │   │
│  │    │  4 GB   │            ───►     │    8 GB       │                            │   │
│  │    └─────────┘                     └───────────────┘                            │   │
│  │                                                                                  │   │
│  │  Triggers:                                                                       │   │
│  │    • OOM kills detected                                                         │   │
│  │    • Tool execution timeouts                                                    │   │
│  │    • Database connection pool exhaustion                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Session-Based Capacity Planning

Voice AI requires **session-based capacity planning**, not request-based:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SESSION CAPACITY MODEL                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CAPACITY FORMULA:                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Max Concurrent Sessions = (Pod Count × Sessions Per Pod) × Utilization Target  │   │
│  │                                                                                  │   │
│  │  Example:                                                                        │   │
│  │    • 5 voice-server pods                                                        │   │
│  │    • 50 sessions per pod (conservative estimate)                                │   │
│  │    • 80% utilization target                                                     │   │
│  │    • Max = 5 × 50 × 0.8 = 200 concurrent voice sessions                        │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  RESOURCE CONSUMPTION PER SESSION:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Resource              │ Idle      │ Active    │ Tool Executing               │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  CPU (per session)     │ ~1%       │ ~3%       │ ~10-50%                       │   │
│  │  Memory (per session)  │ ~20MB     │ ~50MB     │ ~100-500MB                    │   │
│  │  Network (per session) │ ~1 Kbps   │ ~50 Kbps  │ ~100 Kbps                     │   │
│  │  Connections (Redis)   │ 1         │ 1-2       │ 1-2                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  SESSION LIFECYCLE IMPACT:                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Time ───────────────────────────────────────────────────────────────────────►  │   │
│  │                                                                                  │   │
│  │  Sessions:  ▁▂▃▅▆▇█████████████████████▇▆▅▃▂▁                                   │   │
│  │             │           Peak hours (9am-6pm local)           │                  │   │
│  │                                                                                  │   │
│  │  Scale Events:                                                                   │   │
│  │    ▲ 8:30am  - Pre-scale to 5 pods (scheduled)                                 │   │
│  │    ▲ 10:15am - HPA scales to 7 pods (reactive)                                 │   │
│  │    ▲ 2:00pm  - Peak: 10 pods                                                   │   │
│  │    ▼ 6:30pm  - Scale down begins                                               │   │
│  │    ▼ 10:00pm - Minimum 3 pods                                                  │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Autoscaling Configuration

**Horizontal Pod Autoscaler (HPA):**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: voice-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: voice-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: active_voice_sessions
      target:
        type: AverageValue
        averageValue: "40"  # Scale when avg sessions per pod > 40
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 15
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### 5.4 Predictive Scaling

```python
# Example: Scheduled scaling for known traffic patterns
# cron-based scaling rules

SCALING_SCHEDULE = {
    # Weekday patterns
    "weekday_morning_warmup": {
        "cron": "0 8 * * 1-5",  # 8 AM Mon-Fri
        "min_replicas": 5,
        "reason": "Pre-scale for business hours"
    },
    "weekday_peak": {
        "cron": "0 10 * * 1-5",  # 10 AM Mon-Fri
        "min_replicas": 8,
        "reason": "Peak morning traffic"
    },
    "weekday_evening": {
        "cron": "0 18 * * 1-5",  # 6 PM Mon-Fri
        "min_replicas": 4,
        "reason": "Reduced evening traffic"
    },
    "weekday_night": {
        "cron": "0 22 * * 1-5",  # 10 PM Mon-Fri
        "min_replicas": 3,
        "reason": "Minimum night capacity"
    },
    # Weekend patterns
    "weekend": {
        "cron": "0 0 * * 0,6",  # Midnight Sat-Sun
        "min_replicas": 3,
        "reason": "Reduced weekend traffic"
    }
}
```

---

## 6. Load Balancing

### 6.1 WebRTC Load Balancing Challenges

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              WEBRTC LOAD BALANCING                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CHALLENGE: WebRTC is peer-to-peer but we still need to load balance API calls         │
│                                                                                         │
│  CLIENT FLOW:                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Browser                   Load Balancer              Voice Server              │   │
│  │     │                           │                          │                    │   │
│  │     │──── GET /session ────────►│                          │                    │   │
│  │     │                           │──── Route (Round Robin)─►│                    │   │
│  │     │                           │◄─── Session + Token ─────│                    │   │
│  │     │◄── Session + Token ───────│                          │                    │   │
│  │     │                           │                          │                    │   │
│  │     │──── POST /sdp ───────────►│                          │                    │   │
│  │     │  (with session token)     │──── Sticky Session ─────►│  (same pod)       │   │
│  │     │                           │◄─── SDP Answer ──────────│                    │   │
│  │     │◄── SDP Answer ────────────│                          │                    │   │
│  │     │                           │                          │                    │   │
│  │     │════ WebRTC Direct ══════════════════════════════════►│ OpenAI Realtime   │   │
│  │     │     (bypasses LB)                                    │                    │   │
│  │     │                           │                          │                    │   │
│  │     │──── Tool Result ─────────►│                          │                    │   │
│  │     │  (callback webhook)       │──── Sticky Session ─────►│  (same pod)       │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  KEY INSIGHT: WebRTC audio goes directly to OpenAI, not through our servers            │
│               Only API calls (/session, /sdp, webhooks) need load balancing            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Load Balancer Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              LOAD BALANCER ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  LAYER 7 (Application Load Balancer)                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  ROUTING RULES:                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Path              │ Target           │ Sticky   │ Timeout              │ │   │
│  │  │  ──────────────────────────────────────────────────────────────────────── │ │   │
│  │  │  /session          │ voice-server     │ No       │ 30s                  │ │   │
│  │  │  /sdp              │ voice-server     │ Cookie*  │ 30s                  │ │   │
│  │  │  /tools/*          │ voice-server     │ Cookie*  │ 300s (long tools)   │ │   │
│  │  │  /webhook/*        │ voice-server     │ Session  │ 30s                  │ │   │
│  │  │  /health           │ voice-server     │ No       │ 5s                   │ │   │
│  │  │  /metrics          │ voice-server     │ No       │ 10s                  │ │   │
│  │  │  /*                │ cdn/static       │ No       │ 30s                  │ │   │
│  │  └────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                  │   │
│  │  * Cookie-based affinity uses session_id from /session response                 │   │
│  │                                                                                  │   │
│  │  HEALTH CHECK:                                                                   │   │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Path: /health                                                             │ │   │
│  │  │  Interval: 10s                                                             │ │   │
│  │  │  Timeout: 5s                                                               │ │   │
│  │  │  Healthy threshold: 2                                                      │ │   │
│  │  │  Unhealthy threshold: 3                                                    │ │   │
│  │  └────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  SESSION AFFINITY IMPLEMENTATION:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Option 1: Cookie-based (Recommended)                                           │   │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Set-Cookie: VOICE_AFFINITY=pod-voice-server-abc123; Path=/; HttpOnly     │ │   │
│  │  │  Duration: Session lifetime (15 min max)                                   │ │   │
│  │  │  Fallback: Round-robin if cookie missing                                   │ │   │
│  │  └────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                  │   │
│  │  Option 2: Header-based (for non-browser clients)                               │   │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  X-Voice-Session-Id: sess_abc123xyz                                        │ │   │
│  │  │  Hashed to consistent pod selection                                        │ │   │
│  │  └────────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 AWS ALB Configuration Example

```yaml
# AWS Application Load Balancer via Terraform
resource "aws_lb" "voice" {
  name               = "voice-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = true
}

resource "aws_lb_target_group" "voice_server" {
  name     = "voice-server-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 10
    path                = "/health"
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 900  # 15 minutes (session max)
    enabled         = true
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.voice_server.arn
  }

  condition {
    path_pattern {
      values = ["/session", "/sdp", "/tools/*", "/webhook/*"]
    }
  }
}
```

### 6.4 Nginx Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: voice-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"
    nginx.ingress.kubernetes.io/session-cookie-name: "VOICE_AFFINITY"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "900"
    nginx.ingress.kubernetes.io/session-cookie-path: "/"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - voice.example.com
    secretName: voice-tls
  rules:
  - host: voice.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: voice-server-svc
            port:
              number: 8000
```

---

## 7. High Availability Patterns

### 7.1 Multi-Region Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              MULTI-REGION DEPLOYMENT                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                              ┌─────────────────────┐                                    │
│                              │   Global DNS        │                                    │
│                              │   (Route53/CF)      │                                    │
│                              │   Latency-based     │                                    │
│                              └──────────┬──────────┘                                    │
│                                         │                                               │
│                    ┌────────────────────┼────────────────────┐                         │
│                    │                    │                    │                         │
│                    ▼                    ▼                    ▼                         │
│  ┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐  │
│  │      US-EAST-1          │ │      EU-WEST-1          │ │      AP-NORTHEAST-1     │  │
│  │      (Primary)          │ │      (Secondary)        │ │      (Secondary)        │  │
│  │                         │ │                         │ │                         │  │
│  │  ┌─────────────────┐   │ │  ┌─────────────────┐   │ │  ┌─────────────────┐   │  │
│  │  │   ALB           │   │ │  │   ALB           │   │ │  │   ALB           │   │  │
│  │  └────────┬────────┘   │ │  └────────┬────────┘   │ │  └────────┬────────┘   │  │
│  │           │            │ │           │            │ │           │            │  │
│  │  ┌────────▼────────┐   │ │  ┌────────▼────────┐   │ │  ┌────────▼────────┐   │  │
│  │  │  K8s Cluster    │   │ │  │  K8s Cluster    │   │ │  │  K8s Cluster    │   │  │
│  │  │  (5-10 pods)    │   │ │  │  (3-5 pods)     │   │ │  │  (3-5 pods)     │   │  │
│  │  └────────┬────────┘   │ │  └────────┬────────┘   │ │  └────────┬────────┘   │  │
│  │           │            │ │           │            │ │           │            │  │
│  │  ┌────────▼────────┐   │ │  ┌────────▼────────┐   │ │  ┌────────▼────────┐   │  │
│  │  │  RDS (Primary)  │   │ │  │  RDS (Replica)  │   │ │  │  RDS (Replica)  │   │  │
│  │  │  Redis Cluster  │   │ │  │  Redis Cluster  │   │ │  │  Redis Cluster  │   │  │
│  │  └─────────────────┘   │ │  └─────────────────┘   │ │  └─────────────────┘   │  │
│  │                         │ │                         │ │                         │  │
│  └─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘  │
│                                                                                         │
│  CROSS-REGION DATA FLOW:                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Primary (US-EAST-1)                                                            │   │
│  │       │                                                                          │   │
│  │       ├───► Async Replication ───► EU-WEST-1 (RDS Read Replica)                │   │
│  │       │     (typically <1s lag)                                                 │   │
│  │       │                                                                          │   │
│  │       └───► Async Replication ───► AP-NORTHEAST-1 (RDS Read Replica)           │   │
│  │                                                                                  │   │
│  │  Session data: Stored locally in Redis (not cross-region)                       │   │
│  │  Reason: Voice sessions are short-lived (15 min max), no failover benefit       │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Failure Modes and Mitigations

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              FAILURE HANDLING MATRIX                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  COMPONENT FAILURES:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Component           │ Detection      │ Mitigation                             │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │  Voice Server Pod    │ Health check   │ Remove from LB, K8s restarts pod      │   │
│  │                      │ (10s interval) │ Sessions reconnect to other pods      │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │  Amplifier Bridge    │ Health check   │ Queue tool requests, retry with       │   │
│  │                      │ Tool timeout   │ exponential backoff                    │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │  Redis              │ Connection err  │ Fallback to in-memory cache           │   │
│  │                      │ Sentinel/Cluster│ Automatic failover to replica        │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │  PostgreSQL         │ Connection err  │ Connection pool retry                  │   │
│  │                      │ RDS Multi-AZ   │ Automatic failover (<60s)             │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │  OpenAI API         │ HTTP 5xx       │ Circuit breaker, inform user           │   │
│  │                      │ Rate limits    │ Queue requests, exponential backoff   │   │
│  │  ───────────────────────────────────────────────────────────────────────────── │   │
│  │  Entire Region      │ DNS health     │ Route53 failover to secondary region  │   │
│  │                      │ check failure  │ Active sessions lost, new sessions OK │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  GRACEFUL DEGRADATION PATTERNS:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Level 1: Full Functionality                                                    │   │
│  │  ├── All tools available                                                        │   │
│  │  ├── Full conversation history                                                  │   │
│  │  └── Real-time analytics                                                        │   │
│  │                                                                                  │   │
│  │  Level 2: Reduced Functionality (Amplifier unavailable)                         │   │
│  │  ├── Voice conversation works                                                   │   │
│  │  ├── Tools disabled, user informed                                              │   │
│  │  └── "I can't execute tasks right now, but I can still help with questions"    │   │
│  │                                                                                  │   │
│  │  Level 3: Voice Only (Database unavailable)                                     │   │
│  │  ├── New conversations work                                                     │   │
│  │  ├── No history persistence                                                     │   │
│  │  └── Sessions limited to current context only                                   │   │
│  │                                                                                  │   │
│  │  Level 4: Maintenance Mode (Critical failure)                                   │   │
│  │  ├── Static page displayed                                                      │   │
│  │  ├── "Service temporarily unavailable"                                          │   │
│  │  └── ETA for recovery if known                                                  │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Circuit Breaker Implementation

```python
# Circuit breaker for external services
from circuitbreaker import circuit

class ServiceHealth:
    """Track health of external dependencies"""
    
    OPENAI_BREAKER_THRESHOLD = 5  # failures before opening
    OPENAI_BREAKER_TIMEOUT = 30   # seconds before half-open
    
    AMPLIFIER_BREAKER_THRESHOLD = 3
    AMPLIFIER_BREAKER_TIMEOUT = 10

@circuit(
    failure_threshold=ServiceHealth.OPENAI_BREAKER_THRESHOLD,
    recovery_timeout=ServiceHealth.OPENAI_BREAKER_TIMEOUT,
    expected_exception=OpenAIServiceError
)
async def create_openai_session(config: SessionConfig) -> Session:
    """Create OpenAI Realtime session with circuit breaker"""
    try:
        response = await openai_client.post(
            "/v1/realtime/client_secrets",
            json=config.dict(),
            timeout=10.0
        )
        return Session(**response.json())
    except httpx.TimeoutException:
        raise OpenAIServiceError("OpenAI timeout")
    except httpx.HTTPStatusError as e:
        if e.response.status_code >= 500:
            raise OpenAIServiceError(f"OpenAI error: {e.response.status_code}")
        raise

@circuit(
    failure_threshold=ServiceHealth.AMPLIFIER_BREAKER_THRESHOLD,
    recovery_timeout=ServiceHealth.AMPLIFIER_BREAKER_TIMEOUT,
    expected_exception=AmplifierServiceError
)
async def execute_tool(tool_name: str, arguments: dict) -> ToolResult:
    """Execute Amplifier tool with circuit breaker"""
    try:
        result = await amplifier_bridge.call_tool(tool_name, arguments)
        return result
    except asyncio.TimeoutError:
        raise AmplifierServiceError("Tool execution timeout")
    except Exception as e:
        raise AmplifierServiceError(f"Tool execution failed: {e}")
```

### 7.4 Health Check Endpoints

```python
from fastapi import FastAPI, Response
from enum import Enum

class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"

@app.get("/health")
async def health_check():
    """
    Kubernetes liveness/readiness probe endpoint.
    Returns 200 if service can accept traffic, 503 otherwise.
    """
    checks = {
        "redis": await check_redis(),
        "amplifier": await check_amplifier(),
    }
    
    all_healthy = all(c["status"] == "ok" for c in checks.values())
    
    if all_healthy:
        return {"status": "healthy", "checks": checks}
    
    # Still return 200 if core functionality works
    if checks["redis"]["status"] == "ok":
        return Response(
            content=json.dumps({"status": "degraded", "checks": checks}),
            status_code=200,  # Accept traffic, but degraded
            media_type="application/json"
        )
    
    return Response(
        content=json.dumps({"status": "unhealthy", "checks": checks}),
        status_code=503,
        media_type="application/json"
    )

@app.get("/health/live")
async def liveness():
    """Simple liveness check - is the process running?"""
    return {"status": "alive"}

@app.get("/health/ready")
async def readiness():
    """Readiness check - can we accept traffic?"""
    redis_ok = await check_redis()
    if redis_ok["status"] != "ok":
        return Response(status_code=503, content="Redis unavailable")
    return {"status": "ready"}
```

---

## 8. Monitoring and Alerting

### 8.1 Observability Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              OBSERVABILITY ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              DATA COLLECTION                                     │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                                  │   │
│  │  METRICS (Prometheus)              LOGS (Loki/ELK)         TRACES (Jaeger)      │   │
│  │  ┌─────────────────────┐          ┌─────────────────┐     ┌─────────────────┐  │   │
│  │  │ • Request latency   │          │ • Structured    │     │ • Request flow  │  │   │
│  │  │ • Session count     │          │   JSON logs     │     │ • Cross-service │  │   │
│  │  │ • Tool execution    │          │ • Error traces  │     │   correlation   │  │   │
│  │  │ • WebRTC stats      │          │ • Audit events  │     │ • Latency       │  │   │
│  │  │ • Resource usage    │          │ • Debug context │     │   breakdown     │  │   │
│  │  └─────────────────────┘          └─────────────────┘     └─────────────────┘  │   │
│  │           │                               │                       │             │   │
│  │           └───────────────────────────────┼───────────────────────┘             │   │
│  │                                           │                                      │   │
│  │                                           ▼                                      │   │
│  │                            ┌─────────────────────────┐                          │   │
│  │                            │   OpenTelemetry         │                          │   │
│  │                            │   Collector             │                          │   │
│  │                            └────────────┬────────────┘                          │   │
│  │                                         │                                        │   │
│  └─────────────────────────────────────────┼────────────────────────────────────────┘   │
│                                            │                                            │
│  ┌─────────────────────────────────────────┼────────────────────────────────────────┐   │
│  │                              STORAGE & VISUALIZATION                             │   │
│  ├─────────────────────────────────────────┼────────────────────────────────────────┤   │
│  │                                         ▼                                        │   │
│  │  ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐   │   │
│  │  │   Prometheus        │   │   Loki / ELK        │   │   Jaeger            │   │   │
│  │  │   (Metrics Store)   │   │   (Log Store)       │   │   (Trace Store)     │   │   │
│  │  └──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘   │   │
│  │             │                         │                         │              │   │
│  │             └─────────────────────────┼─────────────────────────┘              │   │
│  │                                       │                                        │   │
│  │                                       ▼                                        │   │
│  │                            ┌─────────────────────────┐                         │   │
│  │                            │      Grafana            │                         │   │
│  │                            │   (Unified Dashboard)   │                         │   │
│  │                            └─────────────────────────┘                         │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              ALERTING                                            │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                                  │   │
│  │  Alertmanager ──────► PagerDuty (Critical)                                      │   │
│  │       │                                                                          │   │
│  │       ├─────────────► Slack (Warning)                                           │   │
│  │       │                                                                          │   │
│  │       └─────────────► Email (Info)                                              │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Key Metrics

```yaml
# Prometheus metrics to collect

# Voice Session Metrics
voice_sessions_active:
  type: gauge
  description: "Number of active voice sessions"
  labels: [region, pod]
  
voice_session_duration_seconds:
  type: histogram
  description: "Duration of voice sessions"
  buckets: [30, 60, 120, 300, 600, 900]
  
voice_session_created_total:
  type: counter
  description: "Total sessions created"
  labels: [region, status]

# Latency Metrics
voice_api_request_duration_seconds:
  type: histogram
  description: "API request latency"
  labels: [endpoint, method, status]
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
  
voice_openai_latency_seconds:
  type: histogram
  description: "OpenAI API latency"
  labels: [operation]
  buckets: [0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]

# Tool Execution Metrics
voice_tool_execution_duration_seconds:
  type: histogram
  description: "Tool execution time"
  labels: [tool_name, status]
  buckets: [0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0]
  
voice_tool_execution_total:
  type: counter
  description: "Total tool executions"
  labels: [tool_name, status]

# Error Metrics
voice_errors_total:
  type: counter
  description: "Total errors"
  labels: [error_type, component]

# Resource Metrics (from cAdvisor/node-exporter)
container_cpu_usage_seconds_total:
container_memory_usage_bytes:
container_network_receive_bytes_total:
```

### 8.3 Alert Rules

```yaml
# Prometheus alerting rules
groups:
  - name: voice-critical
    rules:
      - alert: VoiceServerDown
        expr: up{job="voice-server"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Voice server is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"
          
      - alert: HighErrorRate
        expr: |
          sum(rate(voice_errors_total[5m])) / 
          sum(rate(voice_api_request_duration_seconds_count[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
          
      - alert: OpenAICircuitOpen
        expr: circuit_breaker_state{service="openai"} == 1
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "OpenAI circuit breaker is open"
          description: "OpenAI service is experiencing failures"

  - name: voice-warning
    rules:
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            rate(voice_api_request_duration_seconds_bucket[5m])
          ) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
          description: "95th percentile latency is {{ $value }}s"
          
      - alert: SessionCapacityHigh
        expr: |
          voice_sessions_active / 
          voice_sessions_capacity * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Session capacity above 80%"
          description: "Current utilization: {{ $value }}%"
          
      - alert: ToolExecutionSlow
        expr: |
          histogram_quantile(0.95,
            rate(voice_tool_execution_duration_seconds_bucket[5m])
          ) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tool execution is slow"
          description: "95th percentile tool execution time is {{ $value }}s"
          
      - alert: PodRestarts
        expr: |
          increase(kube_pod_container_status_restarts_total{
            namespace="voice-production"
          }[1h]) > 3
        labels:
          severity: warning
        annotations:
          summary: "Pod experiencing restarts"
          description: "{{ $labels.pod }} has restarted {{ $value }} times"
```

### 8.4 Dashboard Panels

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              GRAFANA DASHBOARD: Voice System                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ROW 1: Overview                                                                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ Active Sessions  │ │ Request Rate     │ │ Error Rate       │ │ Avg Latency      │   │
│  │      127         │ │    45.2/s        │ │     0.3%         │ │    142ms         │   │
│  │   ▲ +12%         │ │   ▲ +8%          │ │   ▼ -0.1%        │ │   ▼ -15ms        │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│                                                                                         │
│  ROW 2: Session Metrics                                                                 │
│  ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐ │
│  │ Sessions Over Time                      │ │ Session Duration Distribution          │ │
│  │                                         │ │                                        │ │
│  │   ▁▂▃▅▆▇████████████████▇▆▅▃▂▁        │ │   █                                    │ │
│  │                                         │ │   █ █                                  │ │
│  │   0  4  8  12  16  20  24 (hours)      │ │   █ █ █                                │ │
│  │                                         │ │   █ █ █ █ █                            │ │
│  │                                         │ │   1m 3m 5m 10m 15m                     │ │
│  └────────────────────────────────────────┘ └────────────────────────────────────────┘ │
│                                                                                         │
│  ROW 3: Latency                                                                         │
│  ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐ │
│  │ API Latency (p50, p95, p99)            │ │ OpenAI Latency                         │ │
│  │                                         │ │                                        │ │
│  │   ─── p99: 450ms                       │ │   ─── Session Create: 320ms           │ │
│  │   ─── p95: 180ms                       │ │   ─── SDP Exchange: 85ms              │ │
│  │   ─── p50: 45ms                        │ │                                        │ │
│  │                                         │ │                                        │ │
│  └────────────────────────────────────────┘ └────────────────────────────────────────┘ │
│                                                                                         │
│  ROW 4: Tools                                                                           │
│  ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐ │
│  │ Tool Executions by Type                │ │ Tool Success Rate                      │ │
│  │                                         │ │                                        │ │
│  │   bash        ████████████ 45%         │ │   bash      ████████████████████ 98%  │ │
│  │   read_file   ████████ 30%             │ │   read_file █████████████████████ 99% │ │
│  │   write_file  ████ 15%                 │ │   write_file ████████████████████ 97% │ │
│  │   web_search  ███ 10%                  │ │   web_search ███████████████████ 95%  │ │
│  │                                         │ │                                        │ │
│  └────────────────────────────────────────┘ └────────────────────────────────────────┘ │
│                                                                                         │
│  ROW 5: Infrastructure                                                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ CPU Usage        │ │ Memory Usage     │ │ Pod Count        │ │ Network I/O      │   │
│  │                  │ │                  │ │                  │ │                  │   │
│  │   ████░░ 65%     │ │   █████░ 72%     │ │   5/10 pods      │ │   ↑ 12 MB/s      │   │
│  │                  │ │                  │ │                  │ │   ↓ 8 MB/s       │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKUP ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  BACKUP TYPES AND SCHEDULES:                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Component          │ Type        │ Frequency    │ Retention   │ RTO    │ RPO  │   │
│  │  ─────────────────────────────────────────────────────────────────────────────  │   │
│  │  PostgreSQL         │ Full        │ Daily 2AM    │ 30 days     │ 1 hour │ 24h  │   │
│  │  PostgreSQL         │ WAL/PITR    │ Continuous   │ 7 days      │ 15 min │ 5min │   │
│  │  Redis              │ RDB         │ Hourly       │ 24 hours    │ 5 min  │ 1hr  │   │
│  │  Configuration      │ Git         │ On change    │ Forever     │ 5 min  │ 0    │   │
│  │  Secrets            │ Vault       │ On change    │ Versioned   │ 5 min  │ 0    │   │
│  │  Container Images   │ Registry    │ On build     │ 90 days     │ 5 min  │ 0    │   │
│  │                                                                                  │   │
│  │  Note: Voice session data is ephemeral (max 15 min), no backup needed           │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  BACKUP FLOW:                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  Primary Region                                   Backup Region                  │   │
│  │  (us-east-1)                                      (us-west-2)                   │   │
│  │                                                                                  │   │
│  │  ┌─────────────┐                                  ┌─────────────┐               │   │
│  │  │ PostgreSQL  │───── Automated Snapshots ───────►│ S3 Bucket   │               │   │
│  │  │  (RDS)      │───── WAL Shipping ──────────────►│ (Encrypted) │               │   │
│  │  └─────────────┘                                  └─────────────┘               │   │
│  │                                                                                  │   │
│  │  ┌─────────────┐                                  ┌─────────────┐               │   │
│  │  │   Redis     │───── RDB Export (hourly) ───────►│ S3 Bucket   │               │   │
│  │  │  Cluster    │                                  │ (Encrypted) │               │   │
│  │  └─────────────┘                                  └─────────────┘               │   │
│  │                                                                                  │   │
│  │  ┌─────────────┐                                  ┌─────────────┐               │   │
│  │  │   Secrets   │───── Vault Replication ─────────►│   Vault     │               │   │
│  │  │   (Vault)   │                                  │  (Standby)  │               │   │
│  │  └─────────────┘                                  └─────────────┘               │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Recovery Procedures

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DISASTER RECOVERY RUNBOOK                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SCENARIO 1: Single Pod Failure                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Impact: Minimal - other pods handle traffic                                    │   │
│  │  Detection: Kubernetes health check fails                                       │   │
│  │  Recovery: Automatic (Kubernetes restarts pod)                                  │   │
│  │  Time to Recovery: 30-60 seconds                                                │   │
│  │  Action Required: None (monitoring only)                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  SCENARIO 2: Node Failure                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Impact: Pods on node terminated, sessions may disconnect                       │   │
│  │  Detection: Node NotReady status                                                │   │
│  │  Recovery:                                                                       │   │
│  │    1. Kubernetes reschedules pods to healthy nodes (automatic)                  │   │
│  │    2. HPA scales up if needed                                                   │   │
│  │    3. Verify service health via dashboard                                       │   │
│  │  Time to Recovery: 2-5 minutes                                                  │   │
│  │  Action Required: Monitor, investigate root cause                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  SCENARIO 3: Database Failure                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Impact: History/analytics unavailable, new data not persisted                  │   │
│  │  Detection: Connection errors, health check fails                               │   │
│  │  Recovery:                                                                       │   │
│  │    1. RDS Multi-AZ: Automatic failover (60-120 seconds)                        │   │
│  │    2. If total failure: Restore from latest snapshot                           │   │
│  │       a. Create new RDS instance from snapshot                                  │   │
│  │       b. Apply WAL logs for point-in-time recovery                             │   │
│  │       c. Update connection string in secrets                                    │   │
│  │       d. Rolling restart of voice-server pods                                   │   │
│  │  Time to Recovery: 5-60 minutes                                                 │   │
│  │  Action Required: Monitor failover, verify data integrity                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  SCENARIO 4: Region Failure                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Impact: All services in region unavailable                                     │   │
│  │  Detection: Route53 health checks fail, alerts fire                             │   │
│  │  Recovery:                                                                       │   │
│  │    1. Route53 automatically routes to secondary region (if configured)          │   │
│  │    2. If manual failover required:                                              │   │
│  │       a. Verify secondary region health                                         │   │
│  │       b. Promote RDS read replica to primary                                    │   │
│  │       c. Update DNS to point to secondary region                                │   │
│  │       d. Scale up secondary region pods                                         │   │
│  │       e. Verify service functionality                                           │   │
│  │    3. Communicate with users (status page)                                      │   │
│  │  Time to Recovery: 5-30 minutes (depends on automation level)                   │   │
│  │  Action Required: Execute runbook, communicate status                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  SCENARIO 5: Security Incident (API Key Compromise)                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Impact: Potential unauthorized access                                          │   │
│  │  Detection: Unusual API patterns, alerts from OpenAI                            │   │
│  │  Recovery:                                                                       │   │
│  │    1. Immediately rotate compromised API key in OpenAI dashboard                │   │
│  │    2. Update secret in Vault/K8s secrets                                        │   │
│  │    3. Rolling restart all voice-server pods                                     │   │
│  │    4. Review audit logs for unauthorized access                                 │   │
│  │    5. Assess and document impact                                                │   │
│  │  Time to Recovery: 5-15 minutes                                                 │   │
│  │  Action Required: Immediate rotation, incident review                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Recovery Scripts

```bash
#!/bin/bash
# disaster-recovery/failover-to-secondary.sh

set -euo pipefail

SECONDARY_REGION="us-west-2"
PRIMARY_REGION="us-east-1"

echo "=== Starting Failover to Secondary Region ==="

# Step 1: Verify secondary region health
echo "Checking secondary region health..."
kubectl --context=${SECONDARY_REGION} get nodes
kubectl --context=${SECONDARY_REGION} get pods -n voice-production

# Step 2: Promote RDS read replica
echo "Promoting RDS read replica..."
aws rds promote-read-replica \
    --db-instance-identifier voice-db-replica \
    --region ${SECONDARY_REGION}

# Step 3: Wait for promotion
echo "Waiting for database promotion..."
aws rds wait db-instance-available \
    --db-instance-identifier voice-db-replica \
    --region ${SECONDARY_REGION}

# Step 4: Update DNS
echo "Updating Route53..."
aws route53 change-resource-record-sets \
    --hosted-zone-id ${HOSTED_ZONE_ID} \
    --change-batch file://dns-failover.json

# Step 5: Scale up secondary region
echo "Scaling up secondary region..."
kubectl --context=${SECONDARY_REGION} scale deployment voice-server \
    --replicas=10 -n voice-production

# Step 6: Verify service
echo "Verifying service health..."
for i in {1..10}; do
    if curl -s https://voice.example.com/health | grep -q "healthy"; then
        echo "Service is healthy!"
        break
    fi
    echo "Waiting for service... ($i/10)"
    sleep 10
done

echo "=== Failover Complete ==="
```

### 9.4 Recovery Time Objectives

| Scenario | RTO Target | RPO Target | Actual Capability |
|----------|------------|------------|-------------------|
| Pod failure | < 1 min | 0 | ✅ ~30 sec |
| Node failure | < 5 min | 0 | ✅ 2-5 min |
| AZ failure | < 10 min | 0 | ✅ 5-10 min |
| Database failure | < 15 min | < 5 min | ✅ 5-15 min |
| Region failure | < 30 min | < 15 min | ✅ 15-30 min |
| Complete data loss | < 4 hours | < 24 hours | ✅ 1-4 hours |

---

## 10. Deployment Checklist

### 10.1 Pre-Deployment

```
□ Infrastructure
  □ VPC and subnets created
  □ Security groups configured
  □ Load balancer provisioned
  □ DNS records created
  □ SSL certificates issued

□ Kubernetes
  □ Cluster created and healthy
  □ Node groups sized appropriately
  □ RBAC policies configured
  □ Network policies in place
  □ Pod security policies enabled

□ Secrets Management
  □ OpenAI API key stored securely
  □ Database credentials in secrets
  □ TLS certificates deployed
  □ Secret rotation configured

□ Observability
  □ Prometheus/metrics server deployed
  □ Log aggregation configured
  □ Tracing enabled
  □ Dashboards created
  □ Alert rules configured
  □ On-call rotation set up
```

### 10.2 Deployment

```
□ Container Images
  □ Images built and scanned
  □ Images pushed to registry
  □ Image tags/digests recorded

□ Kubernetes Resources
  □ Namespaces created
  □ ConfigMaps deployed
  □ Secrets deployed
  □ Deployments applied
  □ Services created
  □ Ingress configured
  □ HPA configured
  □ PDBs configured

□ Database
  □ Schema migrations applied
  □ Indexes created
  □ Connection pooling configured
  □ Backups verified

□ Redis
  □ Cluster healthy
  □ Persistence configured
  □ Memory limits set
```

### 10.3 Post-Deployment Verification

```
□ Functional Tests
  □ Health endpoints responding
  □ Session creation works
  □ WebRTC connection succeeds
  □ Voice conversation functional
  □ Tool execution works
  □ Error handling correct

□ Performance Tests
  □ Latency within SLA
  □ Throughput meets requirements
  □ No memory leaks detected
  □ CPU usage stable

□ Security Tests
  □ TLS configured correctly
  □ No exposed secrets
  □ Rate limiting working
  □ Authentication enforced
  □ Audit logging active

□ Monitoring Verification
  □ Metrics being collected
  □ Logs flowing to aggregator
  □ Traces visible
  □ Alerts firing correctly
  □ Dashboards accurate
```

### 10.4 Go-Live Checklist

```
□ Final Checks
  □ Runbooks documented and tested
  □ On-call team trained
  □ Rollback procedure verified
  □ Communication plan ready
  □ Status page configured

□ Staged Rollout
  □ Canary deployment (5% traffic)
  □ Monitor for 30 minutes
  □ Increase to 25% traffic
  □ Monitor for 1 hour
  □ Full rollout
  □ Monitor for 24 hours

□ Documentation
  □ Architecture docs updated
  □ API documentation current
  □ Operational runbooks complete
  □ Incident response plan ready
```

---

## Appendix A: Quick Reference

### Container Commands

```bash
# Build images
docker build -t voice-server:latest ./voice-server
docker build -t amplifier-bridge:latest ./amplifier-bridge

# Push to registry
docker push ${REGISTRY}/voice-server:latest
docker push ${REGISTRY}/amplifier-bridge:latest

# Local testing
docker-compose up -d
docker-compose logs -f voice-server
```

### Kubernetes Commands

```bash
# Deploy
kubectl apply -k overlays/production/

# Check status
kubectl get pods -n voice-production
kubectl describe pod <pod-name> -n voice-production
kubectl logs <pod-name> -n voice-production

# Scale
kubectl scale deployment voice-server --replicas=5 -n voice-production

# Rollback
kubectl rollout undo deployment/voice-server -n voice-production

# Port forward for debugging
kubectl port-forward svc/voice-server-svc 8000:8000 -n voice-production
```

### Monitoring Commands

```bash
# Check metrics
curl http://localhost:8000/metrics

# Prometheus query
rate(voice_sessions_active[5m])

# Logs (if using kubectl)
kubectl logs -l app=voice-server -n voice-production --tail=100 -f
```

---

## Appendix B: Cost Estimation

### Monthly Cost Breakdown (Production)

| Component | Specification | Monthly Cost (USD) |
|-----------|--------------|-------------------|
| EKS Cluster | 1 cluster | ~$73 |
| EC2 (voice-server) | 5x m5.large | ~$350 |
| EC2 (amplifier) | 2x m5.xlarge | ~$280 |
| RDS PostgreSQL | db.r5.large Multi-AZ | ~$350 |
| ElastiCache Redis | cache.r5.large | ~$150 |
| ALB | 1 load balancer | ~$25 |
| Data Transfer | ~500 GB/month | ~$50 |
| S3 (backups/logs) | ~100 GB | ~$5 |
| CloudWatch | Logs + metrics | ~$50 |
| **Total Infrastructure** | | **~$1,333/month** |
| | | |
| **OpenAI Costs** | (varies by usage) | |
| Light usage (1K sessions/month) | | ~$1,200 |
| Medium usage (10K sessions/month) | | ~$12,000 |
| Heavy usage (100K sessions/month) | | ~$120,000 |

*Note: OpenAI costs dominate at scale. Infrastructure is ~10% of total cost for medium usage.*

---

*Document Version: 1.0.0*  
*Last Updated: 2026-01-31*  
*Authors: Architecture Team*
