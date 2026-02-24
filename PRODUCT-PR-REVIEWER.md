# PR Reviewer

**AI code review that knows your team's standards, not just generic best practices.**

---

## What is it?

PR Reviewer is an AI-powered code review tool that posts review comments directly on your GitHub (and later GitLab) pull requests. Unlike generic AI reviewers, it's connected to your team's knowledge brain (Nugget) — so it reviews code against your actual conventions, past decisions, and documented patterns.

It also learns: recurring review findings get proposed back to Nugget as new documented patterns, creating a flywheel where reviews improve your knowledge base and your knowledge base improves reviews.

---

## Who is it for?

- **Engineering teams** who want consistent, thorough code review without bottlenecking on senior engineers
- **Teams using Nugget** who want their documented knowledge to actively enforce standards
- **Growing teams** where new hires need to learn conventions without blocking senior reviewers
- **Any team** tired of leaving the same review comments on the same mistakes, over and over

---

## The Core Problem

Code review is broken at scale.

**Reviewers lack context.** They don't remember the decision your team made 6 months ago about caching strategy. They haven't read every PR in the payments module. They may not know the convention for error handling in this specific subsystem.

**AI reviewers today operate in a vacuum.** They check for generic best practices — "consider adding a TTL" — but they don't know that your team already has a documented caching policy requiring explicit TTLs with specific durations. They give generic advice when your team already has specific answers.

**Tribal knowledge stays in heads.** The senior engineer who knows the codebase best becomes a bottleneck. Every PR needs their review. When they're out, reviews stall or miss things.

PR Reviewer solves this by connecting AI review to your team's actual knowledge.

---

## How It Works

### Install and connect

1. Install the PR Reviewer GitHub App on your org/repo
2. Point it at your team's Nugget brain (optional — works without it, just gives generic reviews)
3. PRs get reviewed automatically

### What a review looks like

When someone opens a PR, PR Reviewer:

1. **Reads the diff** — understands what changed, classifies the type of change (new feature, bug fix, refactor, config change)
2. **Checks your knowledge brain** — finds relevant patterns, decisions, and conventions from Nugget
3. **Reviews with context** — the AI sees both the code AND your team's documented standards
4. **Posts comments** — inline comments on specific lines + a summary comment with risk assessment

**Without Nugget connected:**

> "Consider adding a TTL to this cache to avoid stale data."

**With Nugget connected:**

> "Team convention requires explicit TTL on all caches (see: pattern/cache-policy). The standard TTL for user session data is 30 minutes, per decision/2024-01-15-session-storage."

The difference: specific, actionable, grounded in YOUR team's actual decisions.

### What a review summary looks like

```
## PR Review Summary

**Risk level**: Medium
**Type**: New feature — adds caching layer for user sessions

### Key Findings

1. **Convention violation** (medium) — `src/cache.rs:42`
   Cache created without explicit TTL.
   Team convention: all caches must have explicit TTL (see: pattern/cache-policy)

2. **Suggestion** (low) — `src/cache.rs:78`
   Consider using the existing CacheBuilder from shared/cache.rs
   instead of constructing directly.

3. **Decision reference** — `src/cache.rs:15`
   Team decided on Redis for session storage (decision/2024-redis-choice).
   This PR uses in-memory storage. Intentional for dev environment only,
   or should this use Redis?

### What looks good
- Error handling follows team patterns
- Tests cover the happy path and main error cases
```

### The knowledge feedback loop

PR Reviewer doesn't just read from Nugget — it writes back.

**Recurring findings become patterns.** If PR Reviewer flags the same issue across 5 different PRs ("no TTL on cache"), it proposes a new documented pattern to your Nugget inbox: "All caches should have explicit TTLs."

**PR decisions become decision records.** When a PR description explains an architectural choice ("We chose in-memory caching for dev because..."), PR Reviewer extracts that as a decision record for your brain.

**The flywheel:**

```
Team knowledge in Nugget → better AI reviews
    ↓
Better reviews → fewer repeated mistakes
    ↓
Review findings → new knowledge proposed to Nugget
    ↓
More team knowledge → even better reviews → ...
```

---

## Key Features

### Context-aware review

Every review is informed by your team's:

- **Patterns** — does this code follow your documented patterns?
- **Decisions** — does this change contradict a past architectural decision?
- **Conventions** — naming, error handling, testing requirements
- **Tool preferences** — which libraries does your team prefer?

### Risk assessment

Each PR gets a risk level (low / medium / high) based on:

- Size and complexity of the change
- Which subsystems are affected
- Whether it touches areas with known bugs or recent incidents
- Whether it contradicts documented decisions

### Structured findings

Every finding has a type and severity:

- **Convention violation** — breaks a documented team standard
- **Bug risk** — potential bug or edge case
- **Suggestion** — improvement opportunity
- **Decision reference** — references a past team decision that's relevant
- **Knowledge gap** — the AI can't find relevant context (maybe the team should document something)

### Confidence filtering

Not every AI observation is worth posting. PR Reviewer scores each finding for confidence and only posts above a configurable threshold. No noise.

### Works without Nugget

If Nugget isn't connected, PR Reviewer still works — it just gives generic AI reviews based on code quality best practices. Useful on its own, much more useful with Nugget.

---

## Where It Lives

PR Reviewer is **GitHub/GitLab native**. The primary experience is review comments on your PRs, just like a human reviewer. You don't need to go to a separate app.

A **dashboard** (web UI) is secondary — for:

- Connecting and configuring repos
- Setting review triggers and thresholds
- Browsing review history
- Viewing analytics (review coverage, common findings, knowledge growth)
- Managing team settings

---

## How It Relates to Nugget

PR Reviewer and Nugget are separate products that work together.

**Nugget** is the knowledge brain — where your team's patterns, decisions, and conventions live.

**PR Reviewer** is a consumer and contributor — it reads from the brain to give better reviews, and writes back to the brain when it discovers new patterns.

```
┌─────────────┐                 ┌─────────────┐
│             │  reads context  │             │
│ PR Reviewer │ ◄────────────── │   Nugget    │
│             │                 │  (Brain)    │
│             │ proposes new    │             │
│             │ knowledge ────► │             │
└─────────────┘                 └─────────────┘
```

You can use either product independently:

- **Nugget without PR Reviewer** — a personal/team knowledge brain, used by AI agents and humans
- **PR Reviewer without Nugget** — a generic AI code reviewer (still useful, just less contextual)
- **Both together** — the full flywheel: knowledge-informed reviews that generate more knowledge

---

## What Makes It Different

| Generic AI reviewers               | PR Reviewer                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| "Consider adding error handling"   | "Team pattern requires error wrapping with context (see: pattern/error-handling-go)" |
| Same generic advice for every team | Advice grounded in YOUR team's documented decisions                                  |
| No memory between reviews          | Learns from patterns across PRs                                                      |
| Findings are disposable            | Recurring findings become documented team knowledge                                  |
| Just reads code                    | Reads code + your team's knowledge brain                                             |

---

## Deployment

### Self-hosted (primary)

- Single binary + database
- Docker image for easy deployment
- Runs alongside Nugget (same machine or same network)
- GitHub App installed per org

### Managed service (future)

- Hosted multi-tenant version
- Each org gets isolated review engine + Nugget instance
- GitHub App Marketplace listing

---

## Open Questions

- **Pricing**: Per-review, per-seat, or per-repo? Free tier for open source?
- **Review trigger**: Review all PRs automatically, or only on request / label?
- **Cost management**: Large PRs are expensive to review with AI. Tiered depth based on PR size?
- **Comment noise**: How aggressively filter low-confidence findings? Configurable per team?
- **Coexistence**: How to work alongside existing tools (CodeRabbit, Codacy, SonarQube)?
