# PR Reviewer: AI-Powered Code Review with Organizational Knowledge

## Problem

Code review is broken at scale. Reviewers lack context about team conventions, past decisions, and architectural patterns. AI code review tools today operate in a vacuum — they check for generic best practices but don't know _your_ team's standards. Meanwhile, tribal knowledge stays locked in senior engineers' heads, and every new hire repeats the same review feedback cycles.

PR Reviewer solves this by connecting AI-powered code review to your team's actual knowledge brain (powered by Nugget). It reviews PRs with the context of your team's documented decisions, patterns, beliefs, and conventions — and feeds review insights back into the knowledge brain as proposals.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    PR Reviewer                        │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ GitHub/     │  │ Review       │  │ Dashboard   │  │
│  │ GitLab      │  │ Engine       │  │ (Web UI)    │  │
│  │ Integration │  │              │  │             │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                │                  │         │
│  ┌──────┴────────────────┴──────────────────┴──────┐  │
│  │              Core Service (Rust)                 │  │
│  │                                                  │  │
│  │  ┌────────────┐ ┌───────────┐ ┌──────────────┐  │  │
│  │  │ PR Parser  │ │ Context   │ │ Comment      │  │  │
│  │  │ & Analyzer │ │ Assembler │ │ Generator    │  │  │
│  │  └────────────┘ └─────┬─────┘ └──────────────┘  │  │
│  │                       │                          │  │
│  │                ┌──────┴──────┐                   │  │
│  │                │  Nugget     │                   │  │
│  │                │  Client     │                   │  │
│  │                └──────┬──────┘                   │  │
│  └───────────────────────┼──────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           │ Local socket / IPC
                    ┌──────┴──────┐
                    │   Nugget    │
                    │ Knowledge   │
                    │   Brain     │
                    └─────────────┘
```

---

## Key Architectural Decisions

### 1. Nugget is a dependency, not embedded

PR Reviewer consumes Nugget's knowledge via its local API (Phase 6 of Nugget plan). It does **not** embed or duplicate the knowledge store. This keeps both products independent and composable.

- If Nugget is running locally, PR Reviewer queries it for context
- If Nugget is not available, PR Reviewer falls back to generic review (still useful, just less contextual)

### 2. Bidirectional knowledge flow

PR Reviewer doesn't just read from Nugget — it writes back:

- **Review patterns** the AI notices across PRs become knowledge proposals in Nugget's merge queue
- **Decision records** extracted from PR discussions are proposed as new knowledge units
- **Convention violations** that get repeatedly flagged suggest a new pattern should be documented

This creates a flywheel: more reviews = more knowledge = better reviews.

### 3. GitHub/GitLab native, not a separate UI

The primary interaction surface is the code host (GitHub, GitLab). PR Reviewer posts comments directly on PRs. The dashboard is secondary — for configuration, analytics, and review history.

### 4. Review as structured analysis, not just comments

Each review is a structured document internally:

```yaml
review:
  pr: owner/repo#123
  risk_level: medium
  summary: "Adds new caching layer for user sessions"
  knowledge_context:
    - pattern: "cache-invalidation-strategy"
      relevance: "PR introduces cache without TTL"
    - decision: "2024-01-15-session-storage"
      relevance: "Team decided on Redis for sessions, this uses in-memory"
  findings:
    - type: convention_violation
      severity: medium
      file: src/cache.rs
      line: 42
      message: "Team convention: all caches must have explicit TTL (see pattern/cache-policy)"
    - type: suggestion
      severity: low
      file: src/cache.rs
      line: 78
      message: "Consider using the existing CacheBuilder from shared/cache.rs"
  proposed_knowledge:
    - type: decision
      title: "In-memory session cache for dev environment"
      confidence: 0.6
```

This structured format enables analytics, learning, and knowledge extraction.

---

## Core Components

### 1. PR Parser & Analyzer (`pr-reviewer-parser`)

- Fetch PR metadata, diff, comments, and commit history from GitHub/GitLab APIs
- Parse diffs into structured change sets (file-level and hunk-level)
- Classify changes: new feature, bug fix, refactor, config change, dependency update, etc.
- Detect PR size and complexity for risk assessment

### 2. Context Assembler (`pr-reviewer-context`)

- Query Nugget's knowledge brain for relevant context:
  - **Patterns** that match the files/modules being changed
  - **Decisions** related to the subsystem being modified
  - **Beliefs** about code quality, architecture preferences
  - **Conventions** (naming, error handling, testing requirements)
- Retrieve relevant past reviews for similar changes
- Build a focused context window for the LLM (not "dump everything," but curated relevance)

### 3. Review Engine (`pr-reviewer-engine`)

- Orchestrate the review pipeline: parse -> assemble context -> LLM review -> structure output
- LLM integration: send PR diff + knowledge context to Claude, receive structured review
- Multi-pass review:
  1. **Quick scan**: High-level risk assessment, obvious issues
  2. **Deep review**: Line-by-line analysis with knowledge context
  3. **Knowledge extraction**: Identify new patterns/decisions from the PR
- Confidence calibration: score each finding, filter low-confidence noise

### 4. Comment Generator (`pr-reviewer-comments`)

- Convert structured findings into well-formatted GitHub/GitLab comments
- Inline comments on specific lines (with knowledge references)
- Summary comment with risk level, overview, and action items
- Link back to relevant knowledge units in Nugget ("see: pattern/cache-policy")
- Tone matching: use the team's `voice.md` from Nugget to match review tone

### 5. Knowledge Feedback Loop (`pr-reviewer-feedback`)

- Extract knowledge proposals from reviews and PR discussions
- Submit proposals to Nugget's merge queue via its API
- Track which review findings led to accepted knowledge (for model improvement)
- Detect recurring review comments that should become documented patterns

### 6. GitHub/GitLab Integration (`pr-reviewer-integrations`)

- **GitHub App** (primary): webhook-driven, installed per org/repo
- **GitLab Integration**: webhook + API token
- Webhook handlers: PR opened, PR updated (new commits), review requested, comment added
- Rate limiting per repo/org to stay within API limits
- Retry logic with exponential backoff for transient failures

### 7. Dashboard (`pr-reviewer-dashboard`)

- **Web UI** (SolidJS or similar lightweight framework)
- Configuration: connected repos, review triggers, severity thresholds, LLM provider settings
- Analytics: review coverage, common findings, knowledge growth, accept rates
- Review history: browse past reviews, see what knowledge was extracted
- Team management: who gets reviews, notification preferences

---

## Tech Stack

| Component          | Choice                     | Why                                                      |
| ------------------ | -------------------------- | -------------------------------------------------------- |
| Core service       | **Rust**                   | Shared ecosystem with Nugget, performance, reliability   |
| HTTP framework     | **axum**                   | Modern Rust web framework, tower middleware ecosystem    |
| GitHub API         | **octocrab**               | Rust GitHub API client                                   |
| GitLab API         | **reqwest** + custom       | No mature Rust GitLab client; thin wrapper over REST API |
| LLM integration    | **reqwest**                | HTTP client for Claude/OpenAI APIs                       |
| Nugget client      | **nugget-client** (crate)  | From Nugget Phase 6, queries knowledge brain             |
| Background jobs    | **tokio** tasks            | Async review pipeline, webhook processing                |
| Database           | **SQLite** (rusqlite)      | Review history, analytics, job queue                     |
| Dashboard frontend | **SolidJS + TypeScript**   | Consistency with Nugget's frontend                       |
| Deployment         | **Single binary + Docker** | Easy self-hosting, or managed service later              |

---

## Workspace Layout

```
pr-reviewer/
  Cargo.toml                          # Workspace root
  crates/
    pr-reviewer-core/                 # Core types: Review, Finding, RiskLevel, etc.
    pr-reviewer-parser/               # PR diff parsing, change classification
    pr-reviewer-context/              # Context assembly from Nugget + history
    pr-reviewer-engine/               # Review pipeline orchestration + LLM
    pr-reviewer-comments/             # Comment generation + formatting
    pr-reviewer-feedback/             # Knowledge extraction -> Nugget proposals
    pr-reviewer-integrations/         # GitHub App, GitLab webhooks
    pr-reviewer-dashboard/            # Web UI backend (axum routes)
    pr-reviewer-server/               # Main binary: HTTP server, webhook handler
  dashboard/                          # SolidJS frontend for dashboard
    src/
      components/
      views/
      lib/
```

---

## Implementation Phases

### Phase 1 — Core + GitHub Integration (Weeks 1-3)

**Goal**: Can receive a GitHub webhook for a new PR, fetch the diff, and log it.

- Set up Cargo workspace
- `pr-reviewer-core`: core types (`Review`, `Finding`, `RiskLevel`, `Severity`, `ChangeSet`, etc.)
- `pr-reviewer-parser`: GitHub diff parsing, change classification (new/modified/deleted files, hunk extraction)
- `pr-reviewer-integrations`: GitHub App setup, webhook handler for `pull_request.opened` and `pull_request.synchronize`
- `pr-reviewer-server`: axum HTTP server, webhook endpoint, basic auth (webhook secret verification)

**Deliverable**: Install GitHub App on a test repo, open a PR, see the diff parsed and logged in the service.

### Phase 2 — Review Engine (Weeks 4-6)

**Goal**: AI reviews PRs and posts comments on GitHub.

- `pr-reviewer-engine`: review pipeline (parse -> LLM -> structured review), multi-pass review strategy
- `pr-reviewer-comments`: convert structured findings to GitHub inline comments + summary comment
- LLM integration: Claude API (primary), with provider abstraction for OpenAI/Ollama
- Confidence filtering: only post findings above configurable threshold
- `pr-reviewer-integrations`: post review comments via GitHub API (as the GitHub App bot)

**Deliverable**: Open a PR on a connected repo, receive an AI-generated review with inline comments and a summary. Review quality is "generic" (no Nugget context yet).

### Phase 3 — Nugget Integration (Weeks 7-9)

**Goal**: Reviews are informed by the team's knowledge brain.

- `pr-reviewer-context`: Nugget client integration, relevant context retrieval (patterns, decisions, conventions)
- Context assembly: curate knowledge context based on changed files, modules, and tags
- Update review engine to include knowledge context in LLM prompts
- Comment generator: add knowledge references ("see: pattern/cache-policy") to findings
- Graceful fallback: if Nugget is unavailable, review proceeds without knowledge context

**Deliverable**: Reviews now reference team-specific patterns and decisions. A finding might say "Team convention requires explicit TTL on all caches (see: pattern/cache-policy)" instead of generic "consider adding a TTL."

### Phase 4 — Knowledge Feedback Loop (Weeks 10-11)

**Goal**: Reviews contribute back to the knowledge brain.

- `pr-reviewer-feedback`: extract knowledge proposals from review findings
- Detect recurring patterns: if the same finding appears across N PRs, propose it as a documented pattern
- Extract decision records from PR descriptions and merged PRs
- Submit proposals to Nugget's merge queue via its local API
- Track proposal acceptance rates for model calibration

**Deliverable**: After reviewing several PRs, Nugget's merge queue shows proposals like "New pattern: All API handlers should validate request size" extracted from review findings.

### Phase 5 — Dashboard + Analytics (Weeks 12-14)

**Goal**: Team can configure, monitor, and learn from reviews.

- `pr-reviewer-dashboard`: axum routes for dashboard API
- Dashboard frontend: SolidJS web app
  - Connected repos management
  - Review configuration (triggers, thresholds, LLM provider)
  - Review history browser
  - Analytics: review coverage, top findings, knowledge growth chart
  - Team settings
- SQLite schema for review history and analytics data
- Notification system: Slack/email alerts for high-severity findings

**Deliverable**: Web dashboard where teams configure PR Reviewer, browse review history, and see analytics on review effectiveness.

### Phase 6 — GitLab + Advanced Features (Weeks 15-17)

**Goal**: Expand platform support and add advanced review capabilities.

- `pr-reviewer-integrations`: GitLab webhook handler, GitLab API for posting reviews
- Advanced review features:
  - **Review chains**: understand how PRs in a stack relate to each other
  - **Review memory**: remember feedback on previous versions of the same PR
  - **Auto-approve**: for low-risk changes that match established patterns (with team opt-in)
  - **Custom review rules**: team-defined checks beyond AI (e.g., "all API changes need migration plan")
- Performance optimization: cache context assembly results, batch LLM calls for large PRs

**Deliverable**: Full GitLab support. Advanced features like review chains and auto-approve for routine changes.

---

## How PR Reviewer Uses Nugget

The two products interact through Nugget's local API (Unix socket / HTTP):

### PR Reviewer reads from Nugget:

| Nugget Knowledge Type | How PR Reviewer Uses It                             |
| --------------------- | --------------------------------------------------- |
| **Patterns**          | Check if PR follows documented patterns             |
| **Decisions**         | Flag changes that contradict past decisions         |
| **Beliefs**           | Calibrate review tone and priorities                |
| **Voice**             | Match review comment tone to team culture           |
| **Conventions**       | Check naming, structure, error handling conventions |
| **Tools config**      | Know which tools/libraries the team prefers         |

### PR Reviewer writes to Nugget:

| What's Extracted                | Nugget Knowledge Type | Trigger                                     |
| ------------------------------- | --------------------- | ------------------------------------------- |
| Recurring review findings       | Pattern proposal      | Same finding appears in N+ PRs              |
| Architectural decisions in PRs  | Decision proposal     | PR description contains decision rationale  |
| New conventions from merged PRs | Convention proposal   | Pattern emerges from accepted code changes  |
| Team preference signals         | Belief proposal       | Consistent accept/reject patterns in review |

---

## Deployment Models

### Self-hosted (primary)

- Single Rust binary + SQLite database
- Docker image for easy deployment
- Runs alongside Nugget on the same machine (or same network for socket access)
- GitHub App installed per org

### Managed service (future)

- Multi-tenant hosted version
- Each org gets isolated review engine + Nugget instance
- GitHub App Marketplace listing
- Usage-based pricing (per review or per seat)

---

## Verification Plan

1. **Unit tests**: Each crate tested independently. Use `insta` for snapshot testing review output.
2. **Integration test**: Mock GitHub webhook -> parse PR -> generate review -> verify comment format.
3. **End-to-end test**: Real GitHub App on test repo, open PR, verify review comment appears.
4. **Nugget integration test**: Start Nugget with sample brain, start PR Reviewer, verify reviews reference knowledge.
5. **Feedback loop test**: Review N PRs, verify knowledge proposals appear in Nugget's queue.

---

## Open Questions

- **Pricing model**: Per-review, per-seat, or per-repo? Free tier for open source?
- **Review trigger**: Review all PRs automatically, or only when review is requested / label is added?
- **LLM cost management**: Large PRs can be expensive to review. Diff chunking strategy? Tiered review depth based on PR size?
- **Multi-model**: Should different review passes use different models (fast model for quick scan, capable model for deep review)?
- **Comment noise**: How aggressively should we filter low-confidence findings? Adjustable per team?
- **Existing review tools**: How to coexist with tools teams already use (CodeRabbit, Codacy, SonarQube)? Complement vs. compete?
- **Monorepo vs. polyrepo**: Different context assembly strategies needed? Per-directory Nugget brain mapping?
