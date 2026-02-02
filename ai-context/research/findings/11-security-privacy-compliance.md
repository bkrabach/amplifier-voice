# Security, Privacy, and Compliance: OpenAI Realtime Voice API

**Research Date:** January 2026  
**Status:** Active research - policies may change

---

## Executive Summary

OpenAI provides robust enterprise-grade security features for API customers, including SOC 2 Type 2 certification, GDPR/CCPA compliance support, and optional HIPAA BAAs. Key considerations for voice applications include:

- **Data Retention:** Default 30-day retention for abuse monitoring; Zero Data Retention (ZDR) available for eligible customers
- **Encryption:** AES-256 at rest, TLS 1.2+ in transit
- **Data Residency:** EU data residency available (Dublin)
- **Compliance:** SOC 2 Type 2, GDPR DPA, HIPAA BAA (eligible cases)
- **API Security:** Project-scoped keys, ephemeral tokens for client-side

---

## 1. Data Handling

### 1.1 How Audio Data is Processed

The Realtime API processes audio in real-time using speech-to-speech models (GPT-4o family). Audio is:

1. **Transmitted** via secure WebSocket (WSS) or WebRTC connections
2. **Processed** in OpenAI's infrastructure for real-time transcription and response
3. **Encrypted** in transit using TLS 1.2 or higher

**Audio Input/Output Formats:**
- PCM16 (default)
- G.711 u-law/a-law (for telephony integration)

### 1.2 Data Storage

| Data Type | Default Retention | With ZDR |
|-----------|------------------|----------|
| API inputs/outputs | 30 days | 0 days |
| Abuse monitoring logs | 30 days | Varies* |
| Application state | 30 days | 0 days |

*Modified Abuse Monitoring (MAM) available for some use cases

**Key Points:**
- Audio data is NOT used to train models by default for API customers
- Data is encrypted at rest using AES-256
- After retention period, data is permanently deleted

**Source:** [OpenAI Enterprise Privacy](https://openai.com/enterprise-privacy/)

---

## 2. Privacy & Data Retention

### 2.1 Default API Data Retention

> "After 30 days, API inputs and outputs are removed from our systems, unless we are legally required to retain them."
> — OpenAI Enterprise Privacy (June 2025)

**What OpenAI Retains by Default:**
- Request/response content for abuse monitoring (30 days)
- Usage metadata for billing
- Logs necessary for security and compliance

**What OpenAI Does NOT Do with API Data:**
- Train models on API customer data (opt-out by default since March 2023)
- Share data with third parties (except subprocessors in DPA)
- Use data for purposes beyond service delivery

### 2.2 Zero Data Retention (ZDR)

**Eligibility Requirements:**
- Enterprise API customers
- Qualifying use cases (healthcare, finance, legal)
- Request through OpenAI sales team

**ZDR Features:**
- No retention of prompts or completions
- Immediate deletion after processing
- May affect some features (e.g., Responses API store parameter)

**How to Request:**
1. Contact OpenAI sales/enterprise team
2. Complete ZDR qualification process
3. ZDR applied at project level

### 2.3 Modified Abuse Monitoring (MAM)

For customers who cannot use ZDR but need reduced monitoring:
- Customized retention periods
- Limited scope of monitored content
- Available through enterprise agreements

---

## 3. Compliance Certifications

### 3.1 SOC 2 Type 2

**Coverage:** API, ChatGPT Enterprise, ChatGPT Business, ChatGPT Edu

**Verified Controls:**
- Security (access controls, encryption, network security)
- Availability (uptime, disaster recovery)
- Confidentiality (data protection, access restrictions)

**Access:** Available via [OpenAI Trust Portal](https://trust.openai.com/)

### 3.2 GDPR Compliance

**OpenAI Support Includes:**
- Data Processing Addendum (DPA) available
- EU Data Residency option (Dublin)
- Data subject rights handling
- Privacy by design principles

**DPA Key Terms:**
- OpenAI acts as data processor
- Customer remains data controller
- Subprocessor list provided
- Standard Contractual Clauses (SCCs) included

**How to Execute DPA:**
- Complete [OpenAI DPA form](https://openai.com/policies/data-processing-addendum/)
- Covers API, ChatGPT Business, ChatGPT Enterprise

**Recent Development:** OpenAI received a €15M GDPR fine from Italian DPA (2024) related to consumer ChatGPT, not enterprise API products. This highlights ongoing regulatory scrutiny.

### 3.3 HIPAA Compliance

**Business Associate Agreement (BAA):**
- Available for eligible API customers
- Covers Protected Health Information (PHI)
- Requires enterprise agreement

**Requirements for HIPAA Use:**
1. Execute BAA with OpenAI
2. Enable Zero Data Retention (recommended)
3. Implement appropriate access controls
4. Document PHI handling procedures

**BAA Request Process:**
> "To use our API platform to process protected health information, you will need to sign our Business Associate Agreement (BAA)."
> — [OpenAI Help Center](https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai-for-the-api-services)

### 3.4 CCPA Compliance

- OpenAI DPA addresses CCPA requirements
- "Service Provider" designation under CCPA
- Data subject request handling supported
- Opt-out mechanisms available

### 3.5 Additional Certifications

| Standard | Status |
|----------|--------|
| CSA STAR | Aligned |
| ISO 27001 | In progress (enterprise roadmap) |
| PCI DSS | Not applicable (no payment processing) |

---

## 4. Data Residency

### 4.1 European Data Residency (Available)

**Announced:** February 2025

**Location:** Dublin, Ireland

**Features:**
- API requests processed in-region
- Zero Data Retention enabled by default
- Content never leaves EU

**How to Enable:**
1. Go to API Platform dashboard
2. Create new Project
3. Select "Europe" as data residency region

**Limitations:**
- New projects only (cannot migrate existing)
- Some features may have limited availability
- Check specific endpoint support

**Source:** [OpenAI Blog - EU Data Residency](https://openai.com/index/introducing-data-residency-in-europe/)

### 4.2 Other Regions

| Region | Status |
|--------|--------|
| United States | Available (default) |
| Europe (Dublin) | Available |
| Asia Pacific | Not yet available |
| Other regions | On roadmap |

---

## 5. API Key Security

### 5.1 Best Practices

**From OpenAI Help Center:**

1. **Use Unique Keys Per Team Member**
   - Each developer gets their own key
   - Enables individual accountability
   - Simplifies revocation if compromised

2. **Never Commit Keys to Source Code**
   - Use environment variables
   - Use secrets management services
   - Add `.env` to `.gitignore`

3. **Use Project-Scoped Keys**
   - Create separate projects for different use cases
   - Apply least-privilege principle
   - Enable granular access control

4. **Rotate Keys Regularly**
   - Establish rotation schedule
   - Use automated rotation where possible
   - Revoke unused keys promptly

5. **Monitor Usage**
   - Set up usage alerts
   - Review logs regularly
   - Investigate anomalies

### 5.2 Key Permissions

OpenAI supports granular key permissions:
- **All** - Full access
- **Read** - Read-only operations
- **Write** - Create/modify operations
- **Restricted** - Specific endpoint access

### 5.3 Ephemeral Tokens for Client-Side

**For Realtime API WebRTC connections:**

```javascript
// Server-side: Generate ephemeral token
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-realtime-preview',
    voice: 'alloy'
  })
});

const { client_secret } = await response.json();
// Pass client_secret.value to client (short-lived token)
```

**Benefits:**
- Never expose main API key to browser
- Token expires quickly (minutes)
- Limits blast radius of compromise
- Enables direct WebRTC connections

**Source:** [OpenAI Realtime API Reference](https://platform.openai.com/docs/api-reference/realtime-beta-sessions/create)

### 5.4 Server-Side Key Storage Recommendations

| Environment | Recommended Approach |
|-------------|---------------------|
| Development | `.env` files (gitignored) |
| Production | Secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) |
| CI/CD | Environment variables in secure pipeline |
| Kubernetes | Kubernetes Secrets or external secrets operator |

---

## 6. User Consent Requirements

### 6.1 Voice Recording Consent

**GDPR Requirements:**
- Voice is considered Personally Identifiable Information (PII)
- Explicit, informed consent required before recording
- Clear disclosure of how voice data will be used
- Right to withdraw consent at any time

**CCPA Requirements:**
- Notice at collection
- Right to know what data is collected
- Right to delete voice data
- Right to opt-out of sale/sharing

### 6.2 Recommended Consent Flow

1. **Pre-Session Disclosure:**
   ```
   "This conversation will be processed by AI. Your voice data
   will be sent to OpenAI for real-time processing. [Privacy Policy]"
   ```

2. **Explicit Consent:**
   - Checkbox or button acknowledgment
   - Record consent timestamp
   - Store consent evidence

3. **Ongoing Indicator:**
   - Visual indicator when recording/processing
   - Easy way to end session
   - Clear data deletion options

### 6.3 Synthetic Voice Disclosure

**OpenAI Usage Policy Requirements:**
- Disclose when AI-generated voice is used
- Don't impersonate real individuals without consent
- Don't use voice synthesis for deception

**Recommended Disclosure:**
```
"You are speaking with an AI assistant powered by OpenAI."
```

---

## 7. Content Filtering & Moderation

### 7.1 Built-in Safety

OpenAI's Realtime API includes:
- Input moderation for harmful requests
- Output filtering for inappropriate content
- Automatic refusal of policy-violating requests

### 7.2 Custom Guardrails Implementation

For additional moderation, implement output guardrails:

**Moderation Categories:**
| Category | Description |
|----------|-------------|
| OFFENSIVE | Hate speech, discrimination, harassment |
| VIOLENCE | Threats, incitement, graphic violence |
| OFF_BRAND | Content violating brand guidelines |
| NONE | Compliant content |

**Implementation Pattern:**
```typescript
// Use gpt-4o-mini for fast classification
const moderationResult = await classifyContent(assistantMessage);

if (moderationResult.category !== 'NONE') {
  // Block or flag the message
  hideMessage(messageId);
  logModeration(moderationResult);
}
```

### 7.3 OpenAI Moderation API

For text content (transcribed audio):
- Free to use
- Classifies: hate, harassment, violence, self-harm, sexual, etc.
- Returns category scores
- Use as pre/post filter

**Note:** Moderation API is text-only; for voice, transcribe first or implement custom audio analysis.

### 7.4 Voice-Specific Considerations

- **Tone detection:** Consider emotional context
- **Real-time filtering:** Must not add significant latency
- **False positives:** Audio context can be ambiguous
- **Async moderation:** Can run parallel to playback, hide if flagged

---

## 8. Security Architecture Recommendations

### 8.1 WebSocket Security (Server-to-Server)

```
[Your Server] --WSS--> [OpenAI Realtime API]
     ^
     |
[Your Client] --HTTPS--> [Your Server]
```

**Benefits:**
- API key never leaves server
- Full control over session management
- Can implement custom auth/rate limiting

### 8.2 WebRTC Security (Client Direct)

```
[Your Server] --HTTPS--> [OpenAI] --> Returns ephemeral token
     ^
     |
[Client] <--WebRTC--> [OpenAI Realtime API] (using ephemeral token)
```

**Benefits:**
- Lower latency (direct connection)
- Reduced server load
- Still secure (ephemeral tokens)

### 8.3 Infrastructure Security Checklist

- [ ] TLS 1.2+ for all connections
- [ ] API keys in secrets manager
- [ ] Ephemeral tokens for client-side
- [ ] Rate limiting implemented
- [ ] Audit logging enabled
- [ ] Access controls configured
- [ ] Incident response plan documented
- [ ] Regular security reviews scheduled

---

## 9. Compliance Checklist

### Pre-Launch

- [ ] Execute DPA with OpenAI (if GDPR applies)
- [ ] Execute BAA with OpenAI (if HIPAA applies)
- [ ] Request ZDR if handling sensitive data
- [ ] Configure EU data residency if needed
- [ ] Document data flows and retention
- [ ] Update privacy policy
- [ ] Implement consent mechanisms
- [ ] Set up moderation/guardrails
- [ ] Configure API key security
- [ ] Enable audit logging

### Ongoing Operations

- [ ] Regular key rotation
- [ ] Monitor for policy changes
- [ ] Respond to data subject requests
- [ ] Review access logs
- [ ] Test incident response procedures
- [ ] Annual compliance review

---

## 10. Key Resources

### Official OpenAI Documentation
- [Enterprise Privacy](https://openai.com/enterprise-privacy/)
- [Security and Privacy](https://openai.com/security-and-privacy/)
- [Business Data Privacy](https://openai.com/business-data/)
- [Data Processing Addendum](https://openai.com/policies/data-processing-addendum/)
- [Usage Policies](https://openai.com/policies/usage-policies/)
- [Trust Portal](https://trust.openai.com/) (SOC 2 reports)

### API Documentation
- [Data Controls Guide](https://platform.openai.com/docs/guides/your-data)
- [API Key Best Practices](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [HIPAA BAA Info](https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai-for-the-api-services)

### Contact
- Enterprise sales: For ZDR, BAA, custom agreements
- Security: security@openai.com
- Privacy: privacy@openai.com

---

## Summary of Key Findings

| Area | Finding | Confidence |
|------|---------|------------|
| Data Retention | 30 days default, ZDR available | High |
| Encryption | AES-256 at rest, TLS 1.2+ transit | High |
| GDPR | DPA available, EU residency option | High |
| HIPAA | BAA available for eligible customers | High |
| SOC 2 | Type 2 certified | High |
| Audio-specific policies | Same as other API data | Medium |
| Content moderation | Built-in + custom guardrails needed | Medium |

**Gaps Identified:**
- Specific audio format handling details not documented
- Voice biometric data handling unclear
- Regional expansion timeline not public

---

*This document reflects publicly available information as of January 2026. OpenAI policies may change; always verify current terms before implementation.*
