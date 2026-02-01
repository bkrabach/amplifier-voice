# Amplifier + Voice Demo Scenarios

> Compelling demonstrations showcasing what's possible when AI meets voice meets local execution

---

## Category 1: "I Didn't Know That Was Possible" (Wow Moments)

### Demo 1: Voice-Created Application
**Setup:** "Create a simple todo app with a web interface and save it to my desktop"

**What Happens:**
- Voice transcribed → Amplifier receives request
- Creates directory structure: `~/Desktop/todo-app/`
- Generates `index.html`, `style.css`, `app.js`
- Opens browser to display the result
- All in ~30 seconds

**Why It's Impressive:** Voice assistants can't create functional applications. This creates real, working code from a single spoken sentence.

---

### Demo 2: Live Code Debugging
**Setup:** "Run my Python script and fix any errors you find"

**What Happens:**
- Executes `python main.py`
- Captures error traceback
- Analyzes error semantically
- Edits the source file to fix the bug
- Re-runs to verify fix
- Reports success verbally

**Why It's Impressive:** Voice → understand error → edit file → verify. No other voice assistant touches your filesystem intelligently.

---

### Demo 3: Instant Meeting Prep
**Setup:** "I have a meeting with Acme Corp in 10 minutes. Prep me."

**What Happens:**
- Searches local files for "Acme Corp" references
- Fetches their website for latest news
- Searches web for recent press releases
- Creates `~/Desktop/acme-prep.md` with summary
- Reads back the key points verbally

**Why It's Impressive:** Combines local knowledge, web research, file creation, and verbal briefing in one command.

---

### Demo 4: Voice-Controlled Git Workflow
**Setup:** "Show me what changed today, commit the authentication fixes, and push to main"

**What Happens:**
- Runs `git diff --stat`
- Identifies auth-related changes
- Stages only those files
- Creates semantic commit message
- Pushes to remote
- Confirms completion verbally

**Why It's Impressive:** Complex multi-step git workflow from natural speech. No typing, no memorizing commands.

---

### Demo 5: Live System Dashboard
**Setup:** "What's eating my CPU right now?"

**What Happens:**
- Runs `top -l 1` or equivalent
- Parses process list
- Identifies resource hogs
- Explains in plain English: "Chrome is using 45% CPU across 12 processes. The tab with YouTube is the heaviest."
- Optionally offers to kill processes

**Why It's Impressive:** System monitoring translated to human-understandable explanation with actionable follow-up.

---

## Category 2: Practical Real-World Demos

### Demo 6: Invoice Processing
**Setup:** "Find all the PDF invoices in my Downloads folder and create a spreadsheet summary"

**What Happens:**
- Globs `~/Downloads/*.pdf`
- Extracts text from each PDF
- Identifies vendor, amount, date
- Creates `invoices-summary.csv`
- Reports total: "Found 7 invoices totaling $3,450"

**Why It's Impressive:** Practical business task, zero manual data entry.

---

### Demo 7: Photo Organization
**Setup:** "Organize my photos from last month by location"

**What Happens:**
- Scans Photos library or folder
- Extracts EXIF location data
- Creates folders: `Paris/`, `London/`, `Unknown/`
- Moves files appropriately
- Reports: "Organized 234 photos into 5 locations"

**Why It's Impressive:** Tedious manual task automated through voice.

---

### Demo 8: Email Draft from Notes
**Setup:** "Turn my meeting notes from today into a follow-up email"

**What Happens:**
- Finds recent notes files
- Identifies meeting content
- Generates professional email draft
- Saves to clipboard or file
- Reads back for approval

**Why It's Impressive:** Voice → find file → transform content → ready to send.

---

### Demo 9: Research Compilation
**Setup:** "Research the top 5 JavaScript frameworks for 2025 and save a comparison"

**What Happens:**
- Web searches for current framework rankings
- Fetches multiple sources
- Synthesizes into comparison table
- Creates `~/Documents/js-frameworks-2025.md`
- Summarizes findings verbally

**Why It's Impressive:** Deep research, synthesis, and deliverable creation from voice.

---

### Demo 10: Schedule Backup
**Setup:** "Back up my Documents folder to my external drive"

**What Happens:**
- Identifies external drive mount
- Runs `rsync` with progress
- Reports: "Backed up 2.3GB, 1,247 files"
- Creates backup log

**Why It's Impressive:** System administration through conversation.

---

## Category 3: Comparison Demos (vs Alexa/Siri)

### Demo 11: The File Search Challenge
**Side-by-Side:**
- **Siri:** "Find files about budget" → Opens Finder search, shows results
- **Amplifier:** "Find files about budget and show me which ones mention Q4" → Searches, greps content, filters, explains results

**Why We Win:** We search INSIDE files, not just filenames.

---

### Demo 12: The Follow-Up Test
**Side-by-Side:**
- **Alexa:** "What's the weather?" → "72°F" / "Remind me about that" → "What should I remind you about?"
- **Amplifier:** "What's in my config file?" → Shows config / "Change the timeout to 30 seconds" → Edits file

**Why We Win:** Persistent context, actionable follow-ups.

---

### Demo 13: The Complexity Test
**Side-by-Side:**
- **Siri:** "Create a presentation about sales" → "I can't do that"
- **Amplifier:** "Create a presentation outline about Q4 sales based on my reports folder" → Creates markdown outline from actual data

**Why We Win:** We handle complex, multi-step, file-dependent tasks.

---

### Demo 14: The Privacy Test
**Side-by-Side:**
- **Alexa:** Sends audio to Amazon servers, stores transcripts
- **Amplifier:** "What sensitive files do I have?" → Searches locally, never sends file contents anywhere

**Why We Win:** Local execution, data stays on device.

---

### Demo 15: The Integration Test
**Side-by-Side:**
- **Siri:** Works with Apple apps, limited third-party
- **Amplifier:** "Run my test suite, then deploy if tests pass" → Executes any toolchain

**Why We Win:** We integrate with YOUR workflow, not predefined apps.

---

## Category 4: Developer Demos

### Demo 16: Voice-Driven TDD
**Setup:** "Create a failing test for user authentication, then implement the code to pass it"

**What Happens:**
- Creates `test_auth.py` with failing test
- Runs pytest, confirms failure
- Implements `auth.py` module
- Runs tests again, confirms pass
- Reports completion

**Why It's Impressive:** Complete TDD cycle by voice.

---

### Demo 17: Code Review Assistant
**Setup:** "Review the changes in my current branch"

**What Happens:**
- Runs `git diff main`
- Analyzes code changes semantically
- Identifies potential issues
- Suggests improvements
- Can create review comments

**Why It's Impressive:** AI code review triggered by voice, with full context.

---

### Demo 18: Dependency Audit
**Setup:** "Are any of my npm packages out of date or vulnerable?"

**What Happens:**
- Runs `npm outdated` and `npm audit`
- Parses results
- Explains: "3 packages have updates. One has a critical vulnerability in lodash."
- Offers to fix: "Should I update them?"

**Why It's Impressive:** Security audit in conversational format.

---

### Demo 19: API Exploration
**Setup:** "Show me how to use the Stripe API to create a customer"

**What Happens:**
- Fetches Stripe API docs
- Generates working code example
- Saves to file
- Explains parameters
- Offers to test with sandbox

**Why It's Impressive:** Interactive documentation + working code generation.

---

### Demo 20: Refactoring Assistant
**Setup:** "Extract the validation logic in user.py into its own module"

**What Happens:**
- Reads `user.py`
- Identifies validation functions
- Creates `validation.py`
- Updates imports in `user.py`
- Runs tests to verify
- Reports changes made

**Why It's Impressive:** Semantic refactoring by voice command.

---

## Category 5: Research Demos

### Demo 21: Competitive Analysis
**Setup:** "Research how Notion, Obsidian, and Roam handle backlinks and summarize"

**What Happens:**
- Searches for each product's backlink implementation
- Fetches documentation pages
- Synthesizes comparison
- Creates `backlinks-comparison.md`
- Highlights key differentiators verbally

**Why It's Impressive:** Multi-source research with deliverable output.

---

### Demo 22: Technical Deep Dive
**Setup:** "Explain how WebRTC NAT traversal works and save it for later"

**What Happens:**
- Searches for authoritative sources
- Fetches MDN, IETF specs, tutorials
- Synthesizes explanation at appropriate level
- Creates well-structured document
- Reads back summary

**Why It's Impressive:** On-demand learning with permanent artifacts.

---

### Demo 23: Market Research
**Setup:** "What are the pricing models for AI coding assistants?"

**What Happens:**
- Identifies competitors (GitHub Copilot, Cursor, etc.)
- Fetches pricing pages
- Creates comparison table
- Analyzes trends
- Saves to file

**Why It's Impressive:** Business intelligence through conversation.

---

## Category 6: Multi-Modal Demos

### Demo 24: Voice → Code → Visualization
**Setup:** "Create a chart showing my git commit frequency over the last month"

**What Happens:**
- Runs `git log --since="1 month ago"`
- Generates Python matplotlib script
- Executes script
- Creates `commit-frequency.png`
- Opens image for viewing
- Describes the pattern verbally

**Why It's Impressive:** Voice → data extraction → code generation → visual output.

---

### Demo 25: Audio → Analysis → Report
**Setup:** "Analyze my log files from yesterday and create an incident report"

**What Happens:**
- Finds relevant log files
- Greps for errors and warnings
- Correlates timestamps
- Creates structured incident report
- Identifies root cause patterns
- Suggests preventive measures

**Why It's Impressive:** Log analysis to executive summary by voice.

---

### Demo 26: Voice → Automation Script
**Setup:** "Create a script that monitors my Downloads folder and organizes files by type"

**What Happens:**
- Creates Python watchdog script
- Sets up file type mappings
- Adds logging
- Tests with sample file
- Offers to add to startup

**Why It's Impressive:** Automation creation through natural language.

---

## Category 7: Long-Running Task Demos

### Demo 27: Fire-and-Forget Build
**Setup:** "Build and test my project, let me know when it's done"

**What Happens:**
- Starts build in background
- User continues working/leaves
- Build completes 10 minutes later
- System notifies: "Build succeeded. 247 tests passed."
- Detailed log available on request

**Why It's Impressive:** Async task execution with intelligent notification.

---

### Demo 28: Overnight Analysis
**Setup:** "Analyze all the Python files in this project for code smells overnight"

**What Happens:**
- Queues comprehensive analysis
- Runs linting, complexity analysis, duplicate detection
- Generates detailed report
- Ready in morning: "Found 23 issues across 45 files. 3 are critical."

**Why It's Impressive:** Batch processing that respects your time.

---

### Demo 29: Continuous Monitoring
**Setup:** "Watch my server logs and alert me if you see any errors"

**What Happens:**
- Tails log files
- Pattern matches for errors
- Immediate voice alert: "Error detected in production at 3:47 PM - database connection timeout"
- Offers to show details or take action

**Why It's Impressive:** Proactive monitoring with intelligent alerting.

---

## Category 8: Multi-Agent Coordination Demos

### Demo 30: Full Feature Development
**Setup:** "Implement a password reset feature for the user system"

**What Happens:**
- **Zen Architect** analyzes requirements, designs module spec
- **Modular Builder** implements the code
- **Bug Hunter** writes and runs tests
- **Post-Task Cleanup** ensures code quality
- Coordination happens automatically
- User gets progress updates and final result

**Why It's Impressive:** Full development workflow from single voice command.

---

### Demo 31: Security Audit Pipeline
**Setup:** "Do a security review of my authentication code"

**What Happens:**
- **Security Guardian** agent activated
- Scans for common vulnerabilities
- Checks for secrets in code
- Reviews auth flow logic
- Generates security report
- Prioritizes findings by severity

**Why It's Impressive:** Specialized expert agents on demand.

---

### Demo 32: Database Migration
**Setup:** "Add a 'preferences' field to the user table"

**What Happens:**
- **Database Architect** designs migration
- Reviews existing schema
- Creates migration file
- Tests migration locally
- Provides rollback strategy
- Ready for deployment

**Why It's Impressive:** Database expertise through conversation.

---

### Demo 33: API Design Review
**Setup:** "Design a REST API for the new inventory system"

**What Happens:**
- **API Contract Designer** takes over
- Gathers requirements through questions
- Designs endpoints and schemas
- Creates OpenAPI specification
- Generates documentation
- Offers to create stub implementation

**Why It's Impressive:** Full API design process guided by voice.

---

## Category 9: Personal Productivity Demos

### Demo 34: Daily Standup Generator
**Setup:** "What did I work on yesterday?"

**What Happens:**
- Checks git history for yesterday's commits
- Reviews modified files
- Checks calendar for meetings
- Generates standup summary
- Reads back: "Yesterday you committed 3 features, fixed 2 bugs, and attended the sprint planning meeting"

**Why It's Impressive:** Automatic work tracking and recall.

---

### Demo 35: Context Switching Helper
**Setup:** "I'm switching to the mobile app project"

**What Happens:**
- Notes current project state
- Opens relevant directories
- Loads project-specific context
- Recalls last session: "Last time you were fixing the login screen animation"
- Ready to continue where you left off

**Why It's Impressive:** Project memory and context restoration.

---

### Demo 36: Learning Assistant
**Setup:** "Teach me how async/await works in Python while I code"

**What Happens:**
- Monitors your file edits
- Provides contextual explanations
- Corrects mistakes in real-time
- Suggests improvements
- Links to relevant documentation

**Why It's Impressive:** Interactive learning integrated with actual work.

---

## Category 10: Integration Demos

### Demo 37: GitHub Issue Workflow
**Setup:** "Create a GitHub issue for the bug I just fixed and link the PR"

**What Happens:**
- Gets recent commit/PR info
- Creates issue with proper labels
- Links to PR
- Adds relevant code references
- Reports: "Created issue #234 and linked to PR #89"

**Why It's Impressive:** Full GitHub workflow by voice.

---

### Demo 38: Docker Development
**Setup:** "Spin up a Postgres database for testing"

**What Happens:**
- Runs `docker run postgres:15`
- Waits for container ready
- Reports connection string
- Offers to run migrations
- Remembers for cleanup later

**Why It's Impressive:** Development infrastructure by voice.

---

### Demo 39: Cloud Deployment
**Setup:** "Deploy the latest version to staging"

**What Happens:**
- Runs deployment script/command
- Monitors progress
- Waits for health checks
- Reports: "Deployed v1.2.3 to staging. Health checks passing."
- Provides rollback option

**Why It's Impressive:** Production operations safely by voice.

---

### Demo 40: Slack Integration
**Setup:** "Send the test results to the team channel"

**What Happens:**
- Formats test results summary
- Posts to configured Slack channel
- Includes key metrics
- Links to full report
- Confirms: "Posted to #engineering"

**Why It's Impressive:** Team communication integrated with development workflow.

---

## Bonus: The Ultimate Demo

### Demo 41: "Build Me a Startup"
**Setup:** "I want to build a SaaS for tracking time. Start with an MVP."

**What Happens (over multiple sessions):**
1. **Session 1:** Architect designs system, creates project structure
2. **Session 2:** Builder implements core features
3. **Session 3:** Creates database schema and migrations
4. **Session 4:** Adds API endpoints
5. **Session 5:** Creates simple frontend
6. **Session 6:** Adds authentication
7. **Session 7:** Deploys to cloud
8. **Final:** Working MVP accessible via URL

**Why It's Impressive:** From idea to deployed application through conversation.

---

## Demo Selection by Audience

| Audience | Best Demos |
|----------|------------|
| **Executives** | #3 (Meeting Prep), #9 (Research), #23 (Market Research) |
| **Developers** | #2 (Debugging), #16 (TDD), #20 (Refactoring), #30 (Full Feature) |
| **IT Admins** | #5 (System Monitor), #10 (Backup), #29 (Log Monitoring) |
| **Designers** | #1 (Create App), #24 (Visualization), #26 (Automation) |
| **Skeptics** | #11-15 (Comparison Demos) |
| **Privacy-Conscious** | #14 (Privacy Test), any local-only demo |

---

## Demo Tips

### For Live Demos
1. **Pre-test everything** - Voice recognition can vary
2. **Have backup typed commands** - In case of ambient noise
3. **Start simple** - Demo 1-3 before complex flows
4. **Show the files** - Open Finder/VS Code to show real changes
5. **Emphasize "no special setup"** - This is your actual machine

### For Recorded Demos
1. **Use screen recording** - Show exactly what happens
2. **Add captions** - For the voice commands
3. **Speed up waiting** - Cut dead time
4. **End with file tree** - Show what was created

### For Comparison Demos
1. **Side-by-side screens** - Split screen recording
2. **Same task, same time** - Start simultaneously
3. **Show limitations clearly** - Siri's "I can't do that" moments
4. **Be fair** - Show what competitors do well too

---

## Technical Requirements for Demos

| Demo | Requires |
|------|----------|
| Git demos | Git repository |
| Docker demos | Docker Desktop |
| GitHub demos | GitHub CLI + auth |
| Cloud demos | Cloud CLI configured |
| PDF demos | PDF extraction library |
| Photo demos | Access to photo library |

---

*Generated for Amplifier + Voice demonstration planning*
