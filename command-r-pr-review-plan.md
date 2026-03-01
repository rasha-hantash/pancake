# Plan: Tmux keybinding to open Pancake for session review

## Context

When working in a Claude Code session (managed by Cove in tmux), you want to press `C-a r` to open Pancake showing the code changes from that session. Pancake already handles Graphite stack-aware diffs (diffing against parent branch, not main). The missing piece is a shortcut that auto-selects the right repo + branch based on the active tmux pane.

## Data flow

```
C-a r  →  cove review  →  detect pane → get cwd + branch from event
  → write pending-review JSON to ~/.local/share/pancake/
  → open Pancake  →  Pancake reads pending review, auto-selects repo + branch
  → existing stack-aware diff rendering kicks in
```

## Stack structure (2 diffs across 2 repos)

### Diff 1: Cove — `cove review` subcommand

**Files to modify:**

- `cove/src/cli.rs` — add `Review` variant
- `cove/src/main.rs` — wire `Command::Review` to `commands::review::run()`
- `cove/src/commands/mod.rs` — add `pub mod review;`

**New files:**

- `cove/src/events.rs` — extract `read_last_line`, `events_dir`, `EventEntry` from `sidebar/state.rs` into shared module
- `cove/src/commands/review.rs` — core logic

**Refactor:** Move `read_last_line`, `events_dir`, and `EventEntry` from `sidebar/state.rs` into a new `src/events.rs` module. Both `sidebar/state.rs` and `commands/review.rs` import from it.

**`commands/review.rs` logic:**

1. Read `$TMUX_PANE` to get current pane ID
2. Scan `~/.cove/events/*.jsonl` using shared `read_last_line` — find the event file whose last entry has matching `pane_id`. Extract `cwd` from that event entry. The event file's stem = Cove session ID.
3. Get current git branch: run `git -C {cwd} branch --show-current`
4. Write `~/.local/share/pancake/pending-review.json`:
   ```json
   {
     "repo_path": "/Users/.../workspace/project",
     "branch": "feat/add-validation",
     "timestamp": "2026-03-01T12:00:00Z"
   }
   ```
5. Launch Pancake: `open -a Pancake` (or fall back to `open http://localhost:1420` during dev)

**Note:** The `cwd` field needs to be added to `EventEntry` (it already exists in the JSONL but the current struct has `#[allow(dead_code)]` on it — just remove that annotation).

### Diff 2: Pancake — auto-select repo + branch from pending review + tmux binding

**Files to modify:**

- `pancake/src-tauri/src/lib.rs` — add `check_pending_review` Tauri command
- `pancake/src/api/types.ts` — add `PendingReview` interface
- `pancake/src/api/tauri.ts` — add `checkPendingReview()` wrapper
- `pancake/src/api/queries.ts` — add `pendingReviewQuery()`
- `pancake/src/routes/__root.tsx` or `pancake/src/routes/index.tsx` — check for pending review on mount/focus, auto-select repo + branch via existing `setActiveRepo` + `setSelectedBranch`
- `dotfiles/tmux/tmux.conf` — add `bind r run-shell 'cove review'` after line 58

**New Tauri command `check_pending_review`:**

```rust
#[tauri::command]
fn check_pending_review() -> Result<Option<PendingReview>, String> {
    let path = dirs::data_dir().join("pancake/pending-review.json");
    if !path.exists() { return Ok(None); }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let review: PendingReview = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    fs::remove_file(&path).ok(); // consume it
    Ok(Some(review))
}
```

**Frontend auto-select logic (in index.tsx or \_\_root.tsx):**

- On component mount + on window focus (`tauri::event::listen("tauri://focus")`), call `checkPendingReview()`
- If a pending review exists:
  1. Check if repo is already in `watchedRepos` — if not, call `addRepo(repo_path)`
  2. Call `setActiveRepo(repo_path)` to select the repo
  3. Call `setSelectedBranch(branch)` to select the branch
  4. Pancake's existing reactive queries (`gitDiffQuery`, `stacksQuery`) automatically fire and render the correct stack-aware diff

**This reuses 100% of existing Pancake UI** — no new routes, no new components, no new diff logic. The pending review just automates the repo+branch selection that the user would otherwise do manually in the sidebar.

## Key design decisions

1. **Git diff, not file-history** — simpler; Pancake already has full git diff + Graphite stack support
2. **Stack-aware diffing** — already built into Pancake via `get_stacks()` + `diffBaseOverride`. Each branch diffs against its parent in the stack, not main
3. **Pending review file** (not CLI args/deep links) — works whether Pancake is running or not; consumed on read so it doesn't re-trigger
4. **`cove review` subcommand** (not standalone script) — Cove already has pane→session event mapping

## Tmux binding

One line in `dotfiles/tmux/tmux.conf` after the existing pane hotkeys (line 58):

```
bind r run-shell 'cove review'
```

## Verification

1. `cd ~/workspace/personal/cove && cargo build` — Cove compiles
2. From a tmux pane running Claude Code, run `cove review` — should write pending-review.json and attempt to open Pancake
3. `cd ~/workspace/personal/pancake && bun run tauri dev` — Pancake opens, check that it reads and consumes the pending-review file
4. Verify the correct repo + branch are auto-selected in the sidebar
5. For a Graphite stack, verify the diff shows changes against the parent branch (not main)
6. Press `C-a r` in tmux — end-to-end test
7. Run `/ci` after each diff
