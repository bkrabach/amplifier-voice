# Amplifier+Voice Use Case Catalog

> Comprehensive documentation of specific use cases demonstrating voice-driven development and productivity workflows.

---

## Table of Contents

1. [Developer Productivity](#1-developer-productivity)
2. [Research and Analysis](#2-research-and-analysis)
3. [Document Creation](#3-document-creation)
4. [Task Management](#4-task-management)
5. [Learning and Education](#5-learning-and-education)
6. [Personal Assistant](#6-personal-assistant)
7. [Business Workflows](#7-business-workflows)

---

## 1. Developer Productivity

### 1.1 Voice-Driven Debugging

**Scenario**: Developer encounters a failing test but wants to stay focused on another task.

**Voice Interaction**:
> "Run the tests in the auth module and tell me what's failing."

**Amplifier Integration**:
```
Voice → task(agent="bug-hunter") → bash("pytest tests/auth/") → read_file(failing test) → analyze error
```

**Expected Outcome**:
- Tests executed automatically
- Failure analysis provided verbally: "Two tests are failing in test_login.py. The issue is a missing mock for the database connection on lines 45 and 78."
- Option to fix: "Would you like me to fix these?"

---

### 1.2 Git Workflow Automation

**Scenario**: Developer finished a feature and wants to commit and push without leaving the terminal.

**Voice Interaction**:
> "Commit my changes with a good message and push to origin."

**Amplifier Integration**:
```
Voice → bash("git status") → bash("git diff --stat") → analyze changes → bash("git add -A") → bash("git commit -m '...'") → bash("git push")
```

**Expected Outcome**:
- Changes analyzed semantically
- Commit message generated: "feat(auth): Add password reset flow with email verification"
- Pushed successfully
- Verbal confirmation: "Committed and pushed. 4 files changed, 127 insertions."

---

### 1.3 Quick Code Navigation

**Scenario**: Developer needs to find where a function is defined across a large codebase.

**Voice Interaction**:
> "Where is the validateToken function defined?"

**Amplifier Integration**:
```
Voice → grep("validateToken", pattern="def |function ") → read_file(match locations) → summarize
```

**Expected Outcome**:
- Instant response: "validateToken is defined in src/auth/jwt.py on line 45. It's also used in 3 other files: middleware.py, routes.py, and tests."
- Context provided without manual searching

---

### 1.4 Dependency Audit

**Scenario**: Security-conscious developer wants to check for vulnerabilities before deployment.

**Voice Interaction**:
> "Check if any of my npm packages have vulnerabilities."

**Amplifier Integration**:
```
Voice → bash("npm audit --json") → parse results → prioritize by severity → summarize
```

**Expected Outcome**:
- "Found 3 vulnerabilities. One critical in lodash - I recommend updating immediately. Two moderate in dev dependencies that can wait."
- Option offered: "Should I run npm audit fix?"

---

### 1.5 Code Review Preparation

**Scenario**: Developer wants to review their own changes before creating a PR.

**Voice Interaction**:
> "Review my changes against main and tell me if anything looks problematic."

**Amplifier Integration**:
```
Voice → bash("git diff main") → task(agent="code-reviewer") → analyze patterns → report issues
```

**Expected Outcome**:
- "Your changes look good overall. A few notes: you have a console.log on line 34 that should be removed, and the error handling in the catch block on line 89 could be more specific."
- Summary ready for PR description

---

### 1.6 Quick Refactoring

**Scenario**: Developer notices a function is getting too long and wants to break it up.

**Voice Interaction**:
> "The processOrder function in checkout.js is too long. Can you break it into smaller functions?"

**Amplifier Integration**:
```
Voice → read_file("checkout.js") → task(agent="modular-builder") → identify logical sections → create helper functions → edit_file()
```

**Expected Outcome**:
- Function refactored into logical units
- "I've split processOrder into three functions: validateOrder, calculateTotals, and submitOrder. Each is now under 20 lines."
- Tests still pass (verified automatically)

---

### 1.7 Environment Setup

**Scenario**: New developer joining a project needs to get their environment running.

**Voice Interaction**:
> "Help me set up this project for development."

**Amplifier Integration**:
```
Voice → read_file("README.md", "package.json", ".env.example") → bash("npm install") → bash("cp .env.example .env") → verify setup
```

**Expected Outcome**:
- Dependencies installed
- Environment configured
- "All set! I've installed 145 packages, copied the example env file, and verified the dev server starts. You're ready to code."

---

### 1.8 API Endpoint Testing

**Scenario**: Developer wants to quickly test an API endpoint they just wrote.

**Voice Interaction**:
> "Test the new user registration endpoint with some sample data."

**Amplifier Integration**:
```
Voice → read_file(route definition) → bash("curl -X POST ...") → parse response → validate
```

**Expected Outcome**:
- "The endpoint returns a 201 with a valid user object. The response includes id, email, and createdAt as expected. One thing: the password field is being returned - you might want to exclude that."

---

### 1.9 Log Analysis

**Scenario**: Production issue requires quick log analysis.

**Voice Interaction**:
> "Search the logs from the last hour for any errors related to payments."

**Amplifier Integration**:
```
Voice → bash("grep -i 'error\|payment' /var/log/app.log --after-context=2") → analyze patterns → summarize
```

**Expected Outcome**:
- "Found 12 payment-related errors in the last hour. They're all the same: timeout connecting to the payment gateway. First occurrence was at 2:34 PM. This might indicate an upstream issue."

---

### 1.10 Database Query Helper

**Scenario**: Developer needs to check data but doesn't want to write SQL.

**Voice Interaction**:
> "How many users signed up this week, and how many completed onboarding?"

**Amplifier Integration**:
```
Voice → read_file(schema) → generate SQL → bash("psql -c '...'") → interpret results
```

**Expected Outcome**:
- "This week: 234 new signups, 189 completed onboarding. That's an 81% completion rate, up from 76% last week."

---

## 2. Research and Analysis

### 2.1 Technology Comparison

**Scenario**: Team lead needs to evaluate technology options for a new project.

**Voice Interaction**:
> "Compare React, Vue, and Svelte for our new dashboard project. Consider bundle size, learning curve, and ecosystem."

**Amplifier Integration**:
```
Voice → web_search("React vs Vue vs Svelte 2025 comparison") → web_fetch(top results) → synthesize → create comparison
```

**Expected Outcome**:
- Verbal summary with key tradeoffs
- Markdown comparison table saved to ~/Desktop/framework-comparison.md
- "Based on your existing React experience, I'd recommend sticking with React. Svelte has better bundle size but a smaller ecosystem."

---

### 2.2 Competitive Analysis

**Scenario**: Product manager preparing for a strategy meeting.

**Voice Interaction**:
> "What features did our competitors launch in the last month?"

**Amplifier Integration**:
```
Voice → web_search(competitor + "new features" for each) → web_fetch(changelogs, blogs) → compile findings
```

**Expected Outcome**:
- "Competitor A launched AI-powered search last week. Competitor B added team collaboration features. Competitor C hasn't announced anything major."
- Report saved for reference

---

### 2.3 Documentation Research

**Scenario**: Developer needs to understand a complex API they're integrating with.

**Voice Interaction**:
> "How do I implement OAuth 2.0 with Stripe Connect? Walk me through the flow."

**Amplifier Integration**:
```
Voice → web_search("Stripe Connect OAuth implementation") → web_fetch(official docs) → extract steps → explain
```

**Expected Outcome**:
- Step-by-step verbal explanation
- Code examples cited
- "Would you like me to create a starter implementation based on these docs?"

---

### 2.4 Bug Investigation

**Scenario**: Developer found a cryptic error and needs to understand it.

**Voice Interaction**:
> "I'm getting 'ECONNRESET' errors intermittently. What causes this and how do I fix it?"

**Amplifier Integration**:
```
Voice → web_search("ECONNRESET Node.js causes solutions") → analyze common causes → relate to codebase context
```

**Expected Outcome**:
- "ECONNRESET means the other side closed the connection unexpectedly. Common causes: network issues, server timeout, or not handling keep-alive. Given your code uses axios, I'd recommend adding retry logic and checking your timeout settings."

---

### 2.5 Best Practices Research

**Scenario**: Developer wants to improve their code quality.

**Voice Interaction**:
> "What are the current best practices for error handling in TypeScript?"

**Amplifier Integration**:
```
Voice → web_search("TypeScript error handling best practices 2025") → fetch authoritative sources → summarize patterns
```

**Expected Outcome**:
- Overview of patterns: Result types, custom error classes, error boundaries
- Practical recommendations for the current project
- Code examples available on request

---

### 2.6 Security Vulnerability Research

**Scenario**: Security alert received about a dependency.

**Voice Interaction**:
> "Tell me about CVE-2025-12345 and whether it affects our project."

**Amplifier Integration**:
```
Voice → web_search("CVE-2025-12345") → web_fetch(NVD, security advisories) → grep(package.json for affected package) → assess impact
```

**Expected Outcome**:
- "This CVE affects package-x versions below 2.3.4. You're on version 2.3.1, so you're vulnerable. The fix is available - should I update it now?"

---

### 2.7 Market Research

**Scenario**: Founder researching market size for a pitch deck.

**Voice Interaction**:
> "What's the market size for developer tools, specifically code review automation?"

**Amplifier Integration**:
```
Voice → web_search("developer tools market size 2025") → web_search("code review automation market") → synthesize data
```

**Expected Outcome**:
- "The developer tools market is estimated at $15B in 2025, growing 12% annually. Code review specifically is a $2B segment. Key players include GitHub, GitLab, and several AI startups."
- Sources cited for verification

---

### 2.8 Academic Research Summary

**Scenario**: Developer wants to understand a paper about a technique they're implementing.

**Voice Interaction**:
> "Summarize the key points of the paper 'Attention Is All You Need' for me."

**Amplifier Integration**:
```
Voice → web_search("Attention Is All You Need paper summary") → web_fetch(multiple explanations) → synthesize accessible summary
```

**Expected Outcome**:
- Plain-language explanation of transformers, self-attention, and why it matters
- Practical implications for the developer's work
- Links to implementation resources

---

### 2.9 Industry Trends Analysis

**Scenario**: CTO preparing for board meeting needs technology trends.

**Voice Interaction**:
> "What are the top 5 technology trends I should discuss at our board meeting?"

**Amplifier Integration**:
```
Voice → web_search("technology trends 2025 enterprise") → web_fetch(Gartner, Forrester reports) → extract trends → rank by relevance
```

**Expected Outcome**:
- "Top trends: 1) AI agents in enterprise workflows, 2) Edge computing for real-time processing, 3) Platform engineering maturity, 4) Zero-trust security everywhere, 5) Sustainable tech initiatives. Want me to prepare talking points for each?"

---

### 2.10 Regulatory Research

**Scenario**: Team needs to understand compliance requirements.

**Voice Interaction**:
> "What do we need to know about GDPR compliance for our user analytics?"

**Amplifier Integration**:
```
Voice → web_search("GDPR analytics compliance requirements") → web_fetch(authoritative guides) → extract checklist
```

**Expected Outcome**:
- Key requirements explained in plain language
- Checklist of required changes
- "Based on your current tracking code, you'll need to add consent management and anonymize IPs."

---

## 3. Document Creation

### 3.1 Meeting Notes to Action Items

**Scenario**: After a meeting, convert raw notes into structured action items.

**Voice Interaction**:
> "Turn my meeting notes from today into a structured summary with action items."

**Amplifier Integration**:
```
Voice → glob("**/meeting-notes*.md") → read_file(most recent) → extract action items → create structured doc
```

**Expected Outcome**:
- Clean summary with attendees, discussion points
- Action items with owners and due dates
- "Created meeting-summary.md with 5 action items. John has 2, Sarah has 2, and you have 1 due Friday."

---

### 3.2 Technical Specification

**Scenario**: Developer needs to document a feature before implementation.

**Voice Interaction**:
> "Help me write a technical spec for adding two-factor authentication."

**Amplifier Integration**:
```
Voice → task(agent="zen-architect") → interactive Q&A → generate spec document → write_file()
```

**Expected Outcome**:
- Questions asked: "What methods - SMS, authenticator app, or both?"
- Spec generated with: Overview, Requirements, Technical Approach, API Changes, Migration Plan
- Document saved for team review

---

### 3.3 README Generation

**Scenario**: Project needs documentation for open-sourcing.

**Voice Interaction**:
> "Generate a README for this project based on the code structure."

**Amplifier Integration**:
```
Voice → glob("**/*") → read_file(package.json, main files) → analyze project → generate README → write_file()
```

**Expected Outcome**:
- Professional README with: Overview, Installation, Usage, API Documentation, Contributing guidelines
- Badges for build status, license, etc.
- "Created README.md with 6 sections. Want me to add any specific sections?"

---

### 3.4 API Documentation

**Scenario**: Backend developer needs to document their endpoints.

**Voice Interaction**:
> "Generate API documentation from my Express routes."

**Amplifier Integration**:
```
Voice → glob("**/routes/*.js") → read_file(each) → extract endpoints → generate OpenAPI spec
```

**Expected Outcome**:
- OpenAPI/Swagger specification generated
- Endpoints documented with parameters, responses, examples
- "Documented 15 endpoints across 4 route files. Saved to api-docs.yaml."

---

### 3.5 Change Log Entry

**Scenario**: Release manager needs to document changes for a release.

**Voice Interaction**:
> "Create a changelog entry for this release based on commits since last tag."

**Amplifier Integration**:
```
Voice → bash("git log v1.2.0..HEAD --oneline") → categorize commits → format changelog → append to CHANGELOG.md
```

**Expected Outcome**:
- Changes categorized: Features, Bug Fixes, Breaking Changes
- Entry added to CHANGELOG.md
- "Added changelog for v1.3.0: 3 new features, 5 bug fixes, 1 breaking change."

---

### 3.6 Incident Report

**Scenario**: After resolving an outage, need to document what happened.

**Voice Interaction**:
> "Help me write a post-mortem for today's database outage."

**Amplifier Integration**:
```
Voice → interactive Q&A (timeline, root cause, resolution) → generate structured report → write_file()
```

**Expected Outcome**:
- Questions asked to gather details
- Report with: Timeline, Impact, Root Cause, Resolution, Action Items
- Follow-up items tracked

---

### 3.7 Proposal Document

**Scenario**: Engineer proposing a technical change needs supporting documentation.

**Voice Interaction**:
> "Help me write a proposal to migrate from MongoDB to PostgreSQL."

**Amplifier Integration**:
```
Voice → web_search("MongoDB to PostgreSQL migration") → read_file(current schema) → generate proposal with analysis
```

**Expected Outcome**:
- Proposal with: Current State, Proposed Change, Benefits, Risks, Migration Plan, Cost Estimate
- Data model comparison included
- "Created migration-proposal.md. Key point: estimated 3-week migration with minimal downtime."

---

### 3.8 Email Drafting

**Scenario**: Developer needs to communicate technical issue to non-technical stakeholders.

**Voice Interaction**:
> "Draft an email explaining the deployment delay to the product team. Keep it non-technical."

**Amplifier Integration**:
```
Voice → gather context → translate technical to business language → format email
```

**Expected Outcome**:
- Clear, non-technical email explaining the situation
- Timeline and next steps included
- "Here's the draft. Key message: 2-day delay due to infrastructure issues, no impact on launch date."

---

### 3.9 Tutorial Creation

**Scenario**: Senior developer creating onboarding materials.

**Voice Interaction**:
> "Create a step-by-step tutorial for setting up our development environment."

**Amplifier Integration**:
```
Voice → read_file(setup scripts, configs) → bash(verify each step) → write_file(tutorial.md)
```

**Expected Outcome**:
- Detailed tutorial with verified steps
- Screenshots described (placeholders for actual images)
- "Created setup-tutorial.md with 12 steps. All verified working on macOS."

---

### 3.10 Architecture Decision Record

**Scenario**: Team wants to document why they chose a particular approach.

**Voice Interaction**:
> "Create an ADR for our decision to use WebSockets instead of polling."

**Amplifier Integration**:
```
Voice → task(agent="zen-architect") → Q&A for context → generate ADR → write_file()
```

**Expected Outcome**:
- ADR format: Context, Decision, Consequences
- Trade-offs documented
- "Created ADR-003-websockets.md. Captured 3 alternatives considered and rationale for choice."

---

## 4. Task Management

### 4.1 Sprint Planning Assistant

**Scenario**: Scrum master preparing for sprint planning.

**Voice Interaction**:
> "What's left in the backlog that's ready for the next sprint?"

**Amplifier Integration**:
```
Voice → bash("gh issue list --label 'ready'") → read_file(sprint capacity) → recommend items
```

**Expected Outcome**:
- "You have 12 issues labeled ready, totaling about 34 story points. Based on last sprint's velocity of 28, I'd recommend: issues #45, #47, #52, and #58 for the core work."

---

### 4.2 Daily Standup Preparation

**Scenario**: Developer preparing for morning standup.

**Voice Interaction**:
> "What did I work on yesterday?"

**Amplifier Integration**:
```
Voice → bash("git log --author=me --since='yesterday' --oneline") → read_file(todo list) → summarize
```

**Expected Outcome**:
- "Yesterday you committed 4 changes: fixed the login bug, added input validation, updated tests, and merged the feature branch. Your open PR has 2 pending comments."

---

### 4.3 PR Review Queue

**Scenario**: Tech lead checking what needs review.

**Voice Interaction**:
> "What PRs are waiting for my review?"

**Amplifier Integration**:
```
Voice → bash("gh pr list --reviewer=@me") → summarize each → prioritize
```

**Expected Outcome**:
- "3 PRs need your review. Highest priority: #123 from Sarah, it's blocking the release. Two others from junior devs - small changes, quick reviews."

---

### 4.4 Blocker Identification

**Scenario**: Project manager checking on team blockers.

**Voice Interaction**:
> "Are there any blocked issues on the board?"

**Amplifier Integration**:
```
Voice → bash("gh issue list --label 'blocked'") → analyze blockers → summarize
```

**Expected Outcome**:
- "2 issues are blocked. Issue #89 is waiting on API credentials from the vendor. Issue #92 needs design approval. Both have been blocked for 3 days."

---

### 4.5 Deadline Tracking

**Scenario**: Developer checking upcoming deadlines.

**Voice Interaction**:
> "What deadlines do I have this week?"

**Amplifier Integration**:
```
Voice → read_file(task files) → bash("gh issue list --assignee=@me") → filter by due date → prioritize
```

**Expected Outcome**:
- "You have 3 deadlines this week: Code review for feature X due tomorrow, documentation update due Wednesday, and the API integration demo on Friday."

---

### 4.6 Issue Creation

**Scenario**: Developer discovers a bug and wants to log it quickly.

**Voice Interaction**:
> "Create a bug report for the pagination issue I just found. It fails when you go past page 100."

**Amplifier Integration**:
```
Voice → gather details through conversation → bash("gh issue create --title '...' --body '...' --label 'bug'")
```

**Expected Outcome**:
- Issue created with proper formatting
- "Created issue #156: Pagination fails after page 100. Tagged as bug, high priority. Added to current sprint."

---

### 4.7 Time Estimation

**Scenario**: Developer asked how long a task will take.

**Voice Interaction**:
> "How long do you think it would take to add dark mode support?"

**Amplifier Integration**:
```
Voice → grep(CSS variables, theme files) → analyze codebase → estimate based on complexity
```

**Expected Outcome**:
- "Based on your current CSS structure, you have about 40 color values to update. If you already use CSS variables: 2-3 hours. If not, add a day for refactoring first."

---

### 4.8 Task Breakdown

**Scenario**: Large task needs to be broken into subtasks.

**Voice Interaction**:
> "Break down the user authentication epic into implementable tasks."

**Amplifier Integration**:
```
Voice → task(agent="zen-architect") → analyze requirements → create subtask list
```

**Expected Outcome**:
- Epic broken into 8 tasks with estimates
- Dependencies mapped
- "Created 8 subtasks. Start with 'Set up auth database schema' - everything else depends on it."

---

### 4.9 Progress Reporting

**Scenario**: Manager needs a status update for stakeholders.

**Voice Interaction**:
> "Give me a progress report on the Q1 roadmap items."

**Amplifier Integration**:
```
Voice → bash("gh issue list --milestone 'Q1'") → calculate completion percentage → summarize
```

**Expected Outcome**:
- "Q1 roadmap is 65% complete. 13 of 20 items done. The 3 at-risk items are: payment integration, performance optimization, and mobile support. Payment is blocked on third-party API access."

---

### 4.10 Workload Balancing

**Scenario**: Tech lead checking team workload distribution.

**Voice Interaction**:
> "How is the workload distributed across the team?"

**Amplifier Integration**:
```
Voice → bash("gh issue list --state open") → group by assignee → calculate load → identify imbalances
```

**Expected Outcome**:
- "Current distribution: Alex has 8 issues (seems overloaded), Jordan has 3, Sam has 5. Suggestion: move 2-3 items from Alex to Jordan who has bandwidth."

---

## 5. Learning and Education

### 5.1 Concept Explanation

**Scenario**: Developer encounters an unfamiliar concept in code review.

**Voice Interaction**:
> "What's the difference between a mutex and a semaphore?"

**Amplifier Integration**:
```
Voice → retrieve knowledge → provide clear explanation with examples
```

**Expected Outcome**:
- Clear verbal explanation with real-world analogy
- "A mutex is like a bathroom key - only one person at a time. A semaphore is like a parking lot - multiple spaces available. Would you like a code example?"

---

### 5.2 Code Pattern Learning

**Scenario**: Junior developer wants to understand a pattern they see in the codebase.

**Voice Interaction**:
> "I keep seeing this 'repository pattern' in our code. Can you explain it and show me an example from our codebase?"

**Amplifier Integration**:
```
Voice → explain pattern → grep("Repository", "class.*Repository") → read_file(example) → walk through
```

**Expected Outcome**:
- Pattern explained conceptually
- Real example from codebase shown
- "In your UserRepository.ts, lines 15-40 show this pattern. The repository abstracts database access so your services don't care if it's SQL or NoSQL."

---

### 5.3 Interactive Coding Tutorial

**Scenario**: Developer learning a new framework while working.

**Voice Interaction**:
> "Teach me how to use React hooks while I build this component."

**Amplifier Integration**:
```
Voice → watch file changes → provide contextual guidance → suggest improvements
```

**Expected Outcome**:
- Real-time feedback as developer codes
- "Good use of useState! Now, since you're fetching data, useEffect would be better here. Want me to show you how?"

---

### 5.4 Best Practice Coaching

**Scenario**: Developer wants feedback on their code style.

**Voice Interaction**:
> "Look at my error handling in utils.js and tell me how I can improve it."

**Amplifier Integration**:
```
Voice → read_file("utils.js") → analyze error handling patterns → suggest improvements
```

**Expected Outcome**:
- Specific feedback on current code
- "Your try-catch on line 45 swallows errors silently. Better to log them or rethrow. Also, consider using custom error classes for different failure types."

---

### 5.5 Algorithm Explanation

**Scenario**: Developer implementing a complex algorithm needs understanding.

**Voice Interaction**:
> "Walk me through how Dijkstra's algorithm works as I implement it."

**Amplifier Integration**:
```
Voice → explain algorithm step by step → watch implementation → validate correctness
```

**Expected Outcome**:
- Step-by-step verbal walkthrough
- "You're on the right track. Now you need a priority queue - that's the key data structure. Your current array approach will work but O(n²). Want me to suggest an optimization?"

---

### 5.6 Technology Deep Dive

**Scenario**: Developer wants to understand how a technology works under the hood.

**Voice Interaction**:
> "How does WebSocket work at the protocol level?"

**Amplifier Integration**:
```
Voice → retrieve technical knowledge → explain layers → optionally fetch RFC details
```

**Expected Outcome**:
- Layered explanation from high to low level
- "It starts with an HTTP upgrade handshake, then switches to a frame-based binary protocol. Each frame has an opcode, length, and optional mask. Want me to go deeper on any part?"

---

### 5.7 Debugging Skill Building

**Scenario**: Junior developer learning to debug effectively.

**Voice Interaction**:
> "Help me debug this without just giving me the answer - teach me your approach."

**Amplifier Integration**:
```
Voice → Socratic method → guide with questions → validate understanding
```

**Expected Outcome**:
- Guided debugging session
- "What does the error message tell you? ...Good. Now, what's the state of `user` at that point? ...Right, it's undefined. What could cause that?"

---

### 5.8 Architecture Learning

**Scenario**: Developer studying system design.

**Voice Interaction**:
> "If I were building Twitter, how would I design the timeline feature?"

**Amplifier Integration**:
```
Voice → task(agent="zen-architect") → walk through design considerations → discuss trade-offs
```

**Expected Outcome**:
- Interactive design discussion
- "First question: read-heavy or write-heavy? ...Right, read-heavy. So you'd want to pre-compute timelines. Two approaches: fan-out on write or fan-out on read. Let's explore both..."

---

### 5.9 Code Review Learning

**Scenario**: Developer wants to improve their code review skills.

**Voice Interaction**:
> "Review this code with me and explain what you're looking for."

**Amplifier Integration**:
```
Voice → read_file(target) → explain review process → highlight findings with reasoning
```

**Expected Outcome**:
- Educational review session
- "I start with the big picture - does this fit the architecture? Then I look for: error handling, edge cases, security issues, performance. Here, I notice the N+1 query on line 67..."

---

### 5.10 Career Development

**Scenario**: Developer preparing for a senior role interview.

**Voice Interaction**:
> "Quiz me on system design concepts for my upcoming interview."

**Amplifier Integration**:
```
Voice → generate questions → evaluate answers → provide feedback
```

**Expected Outcome**:
- Interactive quiz session
- "Design a URL shortener. You have 10 minutes. ...Good start on the API. What about the hash function? ...Consider collision handling. How would you scale reads?"

---

## 6. Personal Assistant

### 6.1 Calendar-Aware Reminders

**Scenario**: Developer needs context-aware reminders.

**Voice Interaction**:
> "Remind me to check on the deployment after my 2pm meeting."

**Amplifier Integration**:
```
Voice → check calendar → set contextual reminder → notify when triggered
```

**Expected Outcome**:
- Reminder set based on calendar context
- After meeting ends: "Hey, your meeting just ended. Time to check on that deployment."

---

### 6.2 Context Switching

**Scenario**: Developer switching between multiple projects.

**Voice Interaction**:
> "I'm switching to the mobile app project."

**Amplifier Integration**:
```
Voice → save current context → load project context → recall last session
```

**Expected Outcome**:
- Environment context switched
- "Switched to mobile-app. Last time you were working on the push notification integration. The test was failing on line 245."

---

### 6.3 Quick Calculations

**Scenario**: Developer needs to do a quick estimate.

**Voice Interaction**:
> "If we have 50,000 daily active users and each makes 10 API calls, how many requests per second is that?"

**Amplifier Integration**:
```
Voice → calculate → present result with context
```

**Expected Outcome**:
- "That's about 5.8 requests per second average. But you should plan for peak - probably 3-4x during busy hours, so around 20-25 RPS. Your current setup should handle that easily."

---

### 6.4 Information Recall

**Scenario**: Developer needs to remember something from earlier.

**Voice Interaction**:
> "What was that API endpoint we discussed for user preferences?"

**Amplifier Integration**:
```
Voice → search conversation history → search related files → retrieve context
```

**Expected Outcome**:
- "Earlier you mentioned /api/v2/users/{id}/preferences. It supports GET and PATCH methods. You were going to add validation for the theme field."

---

### 6.5 File Search and Open

**Scenario**: Developer knows what they're looking for but not where it is.

**Voice Interaction**:
> "Find and open the file where we handle Stripe webhooks."

**Amplifier Integration**:
```
Voice → grep("stripe.*webhook", "handleWebhook") → identify file → provide location
```

**Expected Outcome**:
- "Found it: src/payments/webhook-handler.ts on line 45. The handleStripeWebhook function processes 6 event types."

---

### 6.6 Schedule Management

**Scenario**: Developer wants to block focus time.

**Voice Interaction**:
> "Block out 2 hours tomorrow morning for deep work on the migration."

**Amplifier Integration**:
```
Voice → find free slots → suggest optimal time → create reminder/note
```

**Expected Outcome**:
- "Tomorrow 9-11 AM looks clear. I've noted that block for migration work. I'll remind you at 8:50 and hold your notifications."

---

### 6.7 Communication Drafting

**Scenario**: Developer needs to respond to a Slack message professionally.

**Voice Interaction**:
> "Help me respond to the CEO's question about the outage. Keep it brief but reassuring."

**Amplifier Integration**:
```
Voice → understand context → draft appropriate response → refine through dialogue
```

**Expected Outcome**:
- Draft provided: "Hi [CEO], the issue was a database connection pool exhaustion during peak load. We've implemented auto-scaling and added monitoring. No data was affected, and we're adding safeguards to prevent recurrence."

---

### 6.8 Personal Knowledge Management

**Scenario**: Developer wants to save something for later.

**Voice Interaction**:
> "Save this solution for the memory leak issue - I'll need it again."

**Amplifier Integration**:
```
Voice → capture current context → write_file(knowledge base) → tag for retrieval
```

**Expected Outcome**:
- "Saved to your knowledge base under 'debugging/memory-leaks'. Tagged with: Node.js, heap, profiling. You can ask me about it anytime."

---

### 6.9 Quick Web Lookup

**Scenario**: Developer needs a quick fact without context switching.

**Voice Interaction**:
> "What's the default port for PostgreSQL?"

**Amplifier Integration**:
```
Voice → retrieve answer → provide with context
```

**Expected Outcome**:
- "PostgreSQL default port is 5432. Your docker-compose.yml is using 5433 - probably to avoid conflict with a local install."

---

### 6.10 End of Day Summary

**Scenario**: Developer wrapping up their workday.

**Voice Interaction**:
> "Summarize what I accomplished today and what I should start with tomorrow."

**Amplifier Integration**:
```
Voice → bash("git log --since='today' --author=me") → read_file(notes, todos) → synthesize
```

**Expected Outcome**:
- "Today: 3 commits (auth fix, tests, docs), reviewed 2 PRs, and closed issue #134. Tomorrow: start with the blocked payment integration - the API keys should be ready by morning."

---

## 7. Business Workflows

### 7.1 Invoice Processing

**Scenario**: Finance needs to process vendor invoices.

**Voice Interaction**:
> "Process the PDF invoices in my Downloads folder and create a summary."

**Amplifier Integration**:
```
Voice → glob("~/Downloads/*.pdf") → extract text from each → parse amounts, vendors, dates → create spreadsheet
```

**Expected Outcome**:
- All invoices processed
- "Processed 7 invoices totaling $12,450. Largest: $5,200 from AWS. Created invoice-summary.csv on your desktop."

---

### 7.2 Client Report Generation

**Scenario**: Consultant needs weekly client report.

**Voice Interaction**:
> "Generate this week's status report for the Acme project."

**Amplifier Integration**:
```
Voice → read_file(project notes) → bash("git log --since='1 week ago'") → compile report → write_file()
```

**Expected Outcome**:
- Professional report generated
- Includes: accomplishments, upcoming work, blockers, hours logged
- "Created acme-weekly-report.pdf. Key highlight: completed API integration ahead of schedule."

---

### 7.3 Meeting Preparation

**Scenario**: Executive preparing for client meeting.

**Voice Interaction**:
> "I have a meeting with TechCorp in 30 minutes. Prep me."

**Amplifier Integration**:
```
Voice → grep(local files for "TechCorp") → web_search("TechCorp recent news") → compile briefing
```

**Expected Outcome**:
- Quick briefing provided
- "TechCorp: Series B startup, 50 employees, your contact is Sarah Chen (CTO). Last meeting: discussed API pricing. Recent news: they announced a partnership with BigCloud yesterday. Key talking points ready."

---

### 7.4 Contract Review Assistance

**Scenario**: Manager reviewing a vendor contract.

**Voice Interaction**:
> "Summarize the key terms in this SaaS agreement."

**Amplifier Integration**:
```
Voice → read_file(contract.pdf) → extract key terms → highlight concerns
```

**Expected Outcome**:
- Key terms summarized: pricing, term length, termination clauses, SLA
- "Notable: 3-year auto-renewal, 90-day termination notice required, 99.9% uptime SLA. Red flag: data ownership clause is vague on section 7.2."

---

### 7.5 Expense Categorization

**Scenario**: Employee needs to categorize expenses for reimbursement.

**Voice Interaction**:
> "Categorize my receipts from last week for expense reporting."

**Amplifier Integration**:
```
Voice → glob(receipt images) → analyze descriptions → categorize by expense type
```

**Expected Outcome**:
- Expenses categorized: Travel, Meals, Software, Hardware
- "8 receipts totaled $456. Breakdown: Travel $234, Meals $122, Software $100. Ready to copy into your expense system."

---

### 7.6 Sales Data Analysis

**Scenario**: Sales manager needs quick insights.

**Voice Interaction**:
> "What were our top-selling products last quarter?"

**Amplifier Integration**:
```
Voice → read_file(sales data) → analyze trends → rank products
```

**Expected Outcome**:
- "Top 3 products: Enterprise Plan ($450K, up 23%), Team Plan ($320K, flat), API Credits ($180K, up 45%). API Credits is your fastest-growing segment."

---

### 7.7 Customer Feedback Synthesis

**Scenario**: Product manager reviewing customer feedback.

**Voice Interaction**:
> "Summarize the customer feedback from this month's support tickets."

**Amplifier Integration**:
```
Voice → read_file(support exports) → categorize themes → identify patterns
```

**Expected Outcome**:
- Themes identified: Performance (35%), UX (28%), Features (22%), Bugs (15%)
- "Main complaint: dashboard load time. 12 tickets mention it specifically. Second most requested feature: dark mode."

---

### 7.8 Competitive Monitoring

**Scenario**: Strategy team tracking competitor moves.

**Voice Interaction**:
> "Any news about our competitors this week?"

**Amplifier Integration**:
```
Voice → web_search(each competitor + "news") → filter relevant → summarize
```

**Expected Outcome**:
- "Competitor A raised Series C ($50M). Competitor B launched in Europe. Competitor C had a public outage on Tuesday. Want me to dig deeper on any of these?"

---

### 7.9 Compliance Checklist

**Scenario**: Security officer preparing for audit.

**Voice Interaction**:
> "Generate a SOC 2 compliance checklist for our current setup."

**Amplifier Integration**:
```
Voice → web_search("SOC 2 requirements checklist") → grep(codebase for compliance patterns) → identify gaps
```

**Expected Outcome**:
- Checklist with current status
- "Access Controls: 80% complete, missing MFA on admin panel. Logging: Complete. Encryption: 90%, need to encrypt backups. Generated full checklist to compliance-checklist.md."

---

### 7.10 Business Email Drafting

**Scenario**: Founder responding to investor inquiry.

**Voice Interaction**:
> "Draft a response to the investor asking about our runway. We have 18 months at current burn."

**Amplifier Integration**:
```
Voice → understand context → draft professional response → refine
```

**Expected Outcome**:
- Professional email drafted
- "Hi [Investor], Thanks for your interest. We currently have 18 months of runway at our current burn rate of $X/month. We're focused on reaching profitability before our next raise. Happy to discuss our path to break-even in more detail..."

---

## Cross-Category Use Cases

### Multi-Domain: Release Day Workflow

**Scenario**: Release manager handling a deployment day.

**Voice Interactions** (sequence):
1. "What's the status of all PRs for this release?" (Task Management)
2. "Run the full test suite." (Developer Productivity)
3. "Generate release notes from the merged PRs." (Document Creation)
4. "Deploy to staging and let me know when it's healthy." (Developer Productivity)
5. "Draft an announcement for the team channel." (Business Workflows)

**Expected Outcome**: Complete release handled via voice throughout the day.

---

### Multi-Domain: New Feature Development

**Scenario**: Developer implementing a complete feature.

**Voice Interactions** (sequence):
1. "Research best practices for implementing rate limiting." (Research)
2. "Create a technical spec for API rate limiting." (Document Creation)
3. "What's a fair estimate for implementing this?" (Task Management)
4. "Explain the token bucket algorithm to me." (Learning)
5. "Help me implement the rate limiter." (Developer Productivity)
6. "Create the PR with a good description." (Developer Productivity)

**Expected Outcome**: Feature fully developed with documentation and understanding.

---

### Multi-Domain: Incident Response

**Scenario**: On-call engineer handling a production incident.

**Voice Interactions** (sequence):
1. "What errors are in the production logs right now?" (Developer Productivity)
2. "Search for similar issues in our runbooks." (Research)
3. "Apply the fix from runbook #23." (Developer Productivity)
4. "Draft an incident communication for stakeholders." (Business Workflows)
5. "Create a post-mortem document for this incident." (Document Creation)

**Expected Outcome**: Incident resolved and documented without context-switching.

---

## Summary Statistics

| Category | Use Cases | Primary Tools Used |
|----------|-----------|-------------------|
| Developer Productivity | 10 | bash, grep, read_file, edit_file, task |
| Research and Analysis | 10 | web_search, web_fetch, read_file |
| Document Creation | 10 | write_file, read_file, task |
| Task Management | 10 | bash (gh), read_file, todo |
| Learning and Education | 10 | read_file, grep, knowledge base |
| Personal Assistant | 10 | Various tools, context management |
| Business Workflows | 10 | read_file, web_search, write_file |

**Total: 70 documented use cases** + 3 cross-category workflows

---

## Implementation Priority

### Phase 1: Core Development (Ship First)
- 1.1-1.5 (Git, debugging, code navigation)
- 2.3-2.4 (Documentation research, bug investigation)
- 4.2, 4.6 (Standup prep, issue creation)

### Phase 2: Productivity Expansion
- 1.6-1.10 (Refactoring, environment, APIs)
- 3.1-3.5 (Document generation)
- 5.1-5.4 (Learning and coaching)

### Phase 3: Business Value
- 7.1-7.5 (Business workflows)
- 6.1-6.10 (Personal assistant features)
- Cross-category workflows

---

*Generated for Amplifier + Voice product development*
