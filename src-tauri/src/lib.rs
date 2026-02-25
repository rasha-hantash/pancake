mod vcs;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

use vcs::{git, graphite, jj, Branch, GitDiffResult, GitLogEntry, VcsBackend};

// ── Comment Types (VCS-agnostic) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: String,
    pub revision: String,
    pub file_path: String,
    pub side: String,
    pub line: usize,
    pub body: String,
    pub severity: String,
    pub created_at: String,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentStore {
    pub version: u32,
    pub repo_path: String,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExport {
    pub repo_path: String,
    pub revision: String,
    pub timestamp: String,
    pub patch: String,
    pub comments: Vec<Comment>,
    pub summary: String,
}

// ── Claude API Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResponse {
    pub proposed_diff: String,
    pub explanation: String,
    pub model: String,
}

// ── Multi-Repo Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoMeta {
    pub path: String,
    pub display_name: String,
    pub vcs: VcsBackend,
    pub has_graphite: bool,
    pub base_branch: Option<String>,
    #[serde(default)]
    pub reviewed_commits: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoWithStatus {
    pub meta: RepoMeta,
    pub has_any_attention: bool,
    pub branch_statuses: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchStatus {
    pub needs_attention: bool,
    pub tip_commit: String,
}

// ── App State ──

pub struct AppState {
    pub repo_path: Mutex<Option<String>>,
    pub repos: Mutex<HashMap<String, RepoMeta>>,
    pub active_repo: Mutex<Option<String>>,
}

// ── Persistence Helpers ──

fn repos_config_path() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pancake");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("repos.json")
}

fn load_repos_from_disk() -> HashMap<String, RepoMeta> {
    let path = repos_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(repos) = serde_json::from_str::<HashMap<String, RepoMeta>>(&content) {
                return repos;
            }
        }
    }
    HashMap::new()
}

fn save_repos_to_disk(repos: &HashMap<String, RepoMeta>) -> Result<(), String> {
    let path = repos_config_path();
    let json = serde_json::to_string_pretty(repos).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to save repos: {}", e))
}

// ── Shared Helpers ──

fn hash_repo_path(repo_path: &str) -> String {
    let hash = Sha256::digest(repo_path.as_bytes());
    format!("{:x}", hash)
}

fn get_comments_path(repo_path: &str) -> PathBuf {
    let hash = hash_repo_path(repo_path);
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pancake")
        .join("comments");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join(format!("{}.json", hash))
}

fn sanitize_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

fn load_comments(repo_path: &str) -> CommentStore {
    let path = get_comments_path(repo_path);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(store) = serde_json::from_str::<CommentStore>(&content) {
                return store;
            }
        }
    }
    CommentStore {
        version: 1,
        repo_path: repo_path.to_string(),
        comments: Vec::new(),
    }
}

fn save_comments_to_disk(repo_path: &str, store: &CommentStore) -> Result<(), String> {
    let path = get_comments_path(repo_path);
    let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to save comments: {}", e))
}

fn detect_vcs(path: &str) -> Option<VcsBackend> {
    let p = Path::new(path);
    if p.join(".git").exists() {
        Some(VcsBackend::Git)
    } else if p.join(".jj").exists() {
        Some(VcsBackend::Jj)
    } else {
        None
    }
}

fn is_graphite_repo(path: &str) -> bool {
    Path::new(path)
        .join(".git")
        .join(".graphite_repo_config")
        .exists()
}

// ── Multi-Repo Tauri Commands ──

#[tauri::command]
fn add_repo(path: String, state: State<AppState>) -> Result<RepoMeta, String> {
    let canonical = fs::canonicalize(&path)
        .map_err(|e| format!("Invalid path: {}", e))?
        .to_string_lossy()
        .to_string();

    let vcs = detect_vcs(&canonical)
        .ok_or_else(|| format!("Not a git or jj repository: {}", canonical))?;

    let has_graphite = vcs == VcsBackend::Git && is_graphite_repo(&canonical);

    // Detect base branch
    let base_branch = if has_graphite {
        // Read Graphite trunk config
        let config_path = Path::new(&canonical)
            .join(".git")
            .join(".graphite_repo_config");
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
            .and_then(|v| {
                v.as_object()
                    .and_then(|obj| {
                        obj.iter()
                            .find(|(_, val)| {
                                val.get("trunk").and_then(|t| t.as_bool()).unwrap_or(false)
                            })
                            .map(|(key, _)| key.clone())
                    })
            })
    } else if vcs == VcsBackend::Git {
        git::detect_base_branch(&canonical).ok()
    } else {
        None
    };

    let display_name = Path::new(&canonical)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| canonical.clone());

    let meta = RepoMeta {
        path: canonical.clone(),
        display_name,
        vcs,
        has_graphite,
        base_branch,
        reviewed_commits: HashMap::new(),
    };

    let mut repos = state.repos.lock().unwrap();
    repos.insert(canonical, meta.clone());
    save_repos_to_disk(&repos)?;

    Ok(meta)
}

#[tauri::command]
fn remove_repo(path: String, state: State<AppState>) -> Result<(), String> {
    let mut repos = state.repos.lock().unwrap();
    repos.remove(&path);
    save_repos_to_disk(&repos)?;

    // Clear active repo if it was the removed one
    let mut active = state.active_repo.lock().unwrap();
    if active.as_deref() == Some(&path) {
        *active = None;
    }

    Ok(())
}

#[tauri::command]
fn list_repos(state: State<AppState>) -> Result<Vec<RepoWithStatus>, String> {
    let repos = state.repos.lock().unwrap();
    let mut result = Vec::new();

    for meta in repos.values() {
        if meta.vcs != VcsBackend::Git {
            result.push(RepoWithStatus {
                meta: meta.clone(),
                has_any_attention: false,
                branch_statuses: HashMap::new(),
            });
            continue;
        }

        let branches = git::list_branches(&meta.path).unwrap_or_default();
        let base = meta
            .base_branch
            .clone()
            .unwrap_or_else(|| "main".to_string());

        let mut branch_statuses = HashMap::new();
        let mut has_any = false;

        for branch in &branches {
            if branch.name == base {
                continue;
            }
            let tip = git::get_branch_tip(&meta.path, &branch.name).unwrap_or_default();
            let reviewed = meta.reviewed_commits.get(&branch.name);
            let needs_attention = reviewed.map_or(true, |r| r != &tip);
            branch_statuses.insert(branch.name.clone(), needs_attention);
            if needs_attention {
                has_any = true;
            }
        }

        result.push(RepoWithStatus {
            meta: meta.clone(),
            has_any_attention: has_any,
            branch_statuses,
        });
    }

    result.sort_by(|a, b| a.meta.display_name.cmp(&b.meta.display_name));
    Ok(result)
}

#[tauri::command]
fn set_active_repo(path: String, state: State<AppState>) -> Result<(), String> {
    *state.active_repo.lock().unwrap() = Some(path);
    Ok(())
}

#[tauri::command]
fn git_list_branches(repo_path: String) -> Result<Vec<Branch>, String> {
    git::list_branches(&repo_path)
}

#[tauri::command]
fn git_detect_base_branch(repo_path: String) -> Result<String, String> {
    git::detect_base_branch(&repo_path)
}

#[tauri::command]
fn git_get_log(
    repo_path: String,
    branch: String,
    base_override: Option<String>,
) -> Result<Vec<GitLogEntry>, String> {
    let base = base_override.unwrap_or_else(|| {
        git::detect_base_branch(&repo_path).unwrap_or_else(|_| "main".to_string())
    });
    git::get_log(&repo_path, &branch, &base)
}

#[tauri::command]
fn git_get_diff(
    repo_path: String,
    branch: String,
    base_override: Option<String>,
) -> Result<GitDiffResult, String> {
    let base = base_override.unwrap_or_else(|| {
        git::detect_base_branch(&repo_path).unwrap_or_else(|_| "main".to_string())
    });
    git::get_diff(&repo_path, &branch, &base)
}

#[tauri::command]
fn get_branch_status(
    repo_path: String,
    branch: String,
    state: State<AppState>,
) -> Result<BranchStatus, String> {
    let tip = git::get_branch_tip(&repo_path, &branch)?;
    let repos = state.repos.lock().unwrap();
    let needs_attention = repos
        .get(&repo_path)
        .and_then(|meta| meta.reviewed_commits.get(&branch))
        .map_or(true, |reviewed| reviewed != &tip);

    Ok(BranchStatus {
        needs_attention,
        tip_commit: tip,
    })
}

#[tauri::command]
fn mark_reviewed(
    repo_path: String,
    branch: String,
    state: State<AppState>,
) -> Result<(), String> {
    let tip = git::get_branch_tip(&repo_path, &branch)?;
    let mut repos = state.repos.lock().unwrap();
    if let Some(meta) = repos.get_mut(&repo_path) {
        meta.reviewed_commits.insert(branch, tip);
        save_repos_to_disk(&repos)?;
    }
    Ok(())
}

// ── Graphite Tauri Commands ──

#[tauri::command]
fn get_stacks(
    repo_path: String,
    state: State<AppState>,
) -> Result<Vec<graphite::Stack>, String> {
    let branches = git::list_branches(&repo_path)?;
    let repos = state.repos.lock().unwrap();
    let reviewed = repos
        .get(&repo_path)
        .map(|m| m.reviewed_commits.clone())
        .unwrap_or_default();
    graphite::build_stacks(&repo_path, &branches, &reviewed)
}

#[tauri::command]
fn get_stack_diff(
    repo_path: String,
    branch: String,
) -> Result<GitDiffResult, String> {
    // Read the branch's parent from Graphite metadata
    let meta = graphite::read_branch_meta(&repo_path, &branch)?;
    git::get_diff(&repo_path, &branch, &meta.parent_branch)
}

// ── Claude API Helpers ──

fn claude_key_path() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pancake");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("claude_key")
}

fn load_claude_key() -> Result<Option<String>, String> {
    let path = claude_key_path();
    if path.exists() {
        let key = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let trimmed = key.trim().to_string();
        if trimmed.is_empty() {
            Ok(None)
        } else {
            Ok(Some(trimmed))
        }
    } else {
        Ok(None)
    }
}

fn extract_diff_block(text: &str) -> String {
    // Look for ```diff ... ``` block
    if let Some(start) = text.find("```diff\n") {
        let content_start = start + "```diff\n".len();
        if let Some(end) = text[content_start..].find("```") {
            return text[content_start..content_start + end].trim().to_string();
        }
    }
    // Fallback: look for generic code block containing a diff
    if let Some(start) = text.find("```\n") {
        let content_start = start + "```\n".len();
        if let Some(end) = text[content_start..].find("```") {
            let candidate = text[content_start..content_start + end].trim();
            if candidate.starts_with("diff --git") || candidate.starts_with("---") {
                return candidate.to_string();
            }
        }
    }
    String::new()
}

fn extract_explanation(text: &str) -> String {
    // Everything before the first code block
    if let Some(start) = text.find("```") {
        text[..start].trim().to_string()
    } else {
        text.trim().to_string()
    }
}

// ── Claude API Tauri Commands ──

#[tauri::command]
fn set_claude_key(key: String) -> Result<(), String> {
    let path = claude_key_path();
    fs::write(&path, key.trim()).map_err(|e| format!("Failed to save API key: {}", e))
}

#[tauri::command]
fn get_claude_key() -> Result<Option<String>, String> {
    load_claude_key()
}

#[tauri::command]
async fn call_claude(
    repo_path: String,
    branch: String,
    base_override: Option<String>,
) -> Result<ClaudeResponse, String> {
    let key = load_claude_key()?
        .ok_or_else(|| "No Claude API key configured".to_string())?;

    // Get diff
    let base = base_override.unwrap_or_else(|| {
        git::detect_base_branch(&repo_path).unwrap_or_else(|_| "main".to_string())
    });
    let diff = git::get_diff(&repo_path, &branch, &base)?;

    // Get unresolved comments
    let store = load_comments(&repo_path);
    let comments: Vec<&Comment> = store
        .comments
        .iter()
        .filter(|c| c.revision == branch && !c.resolved)
        .collect();

    if comments.is_empty() {
        return Err("No unresolved comments to resolve".to_string());
    }

    // Build prompt
    let system = "You are a senior software engineer reviewing code. Given a git diff and \
        review comments, produce a unified diff patch that addresses ALL comments. \
        The patch must be directly applicable with `git apply`.\n\n\
        Output format:\n\
        1. Provide a brief explanation of the changes you're making.\n\
        2. Output the complete unified diff inside a code block marked with ```diff ... ```\n\n\
        The diff must be a valid unified diff that can be applied with `git apply`. \
        Only include the changed files — do not reproduce the entire original diff.";

    let mut user_msg = String::new();
    user_msg.push_str("## Current Diff\n\n```diff\n");
    user_msg.push_str(&diff.patch);
    user_msg.push_str("\n```\n\n## Review Comments\n\n");

    for c in &comments {
        user_msg.push_str(&format!(
            "- **{}** (`{}`, line {}, side {}): {}\n",
            c.severity, c.file_path, c.line, c.side, c.body
        ));
    }

    user_msg.push_str(
        "\nPlease produce a unified diff that addresses all the above comments.",
    );

    // Call Claude API
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "claude-opus-4-6",
        "max_tokens": 16384,
        "system": system,
        "messages": [
            { "role": "user", "content": user_msg }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to call Claude API: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Claude API error ({}): {}", status, response_text));
    }

    let response_json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract text from content blocks
    let content = response_json["content"]
        .as_array()
        .ok_or_else(|| "Invalid response: no content array".to_string())?;

    let mut full_text = String::new();
    for block in content {
        if block["type"].as_str() == Some("text") {
            if let Some(text) = block["text"].as_str() {
                full_text.push_str(text);
            }
        }
    }

    if full_text.is_empty() {
        return Err("Claude returned an empty response".to_string());
    }

    let proposed_diff = extract_diff_block(&full_text);
    let explanation = extract_explanation(&full_text);

    let model = response_json["model"]
        .as_str()
        .unwrap_or("claude-opus-4-6")
        .to_string();

    Ok(ClaudeResponse {
        proposed_diff,
        explanation,
        model,
    })
}

#[tauri::command]
fn apply_proposed_changes(repo_path: String, patch: String) -> Result<(), String> {
    // Write patch to temp file
    let temp_file = std::env::temp_dir().join(format!(
        "pancake_patch_{}.diff",
        uuid::Uuid::new_v4()
    ));
    fs::write(&temp_file, &patch)
        .map_err(|e| format!("Failed to write temp patch: {}", e))?;

    let temp_path = temp_file.to_string_lossy().to_string();

    // Dry run validation
    let check = git::run_git(&repo_path, &["apply", "--check", &temp_path]);
    if let Err(e) = check {
        fs::remove_file(&temp_file).ok();
        return Err(format!("Patch validation failed: {}", e));
    }

    // Apply and stage
    let result = git::run_git(&repo_path, &["apply", "--index", &temp_path]);
    fs::remove_file(&temp_file).ok();
    result.map(|_| ())
}

// ── Legacy jj Tauri Commands (delegating to vcs::jj) ──

#[tauri::command]
fn set_repo_path(path: String, state: State<AppState>) -> Result<String, String> {
    let jj_dir = Path::new(&path).join(".jj");
    if !jj_dir.exists() {
        return Err(format!("Not a jj repository: {}", path));
    }
    let canonical = fs::canonicalize(&path)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    *state.repo_path.lock().unwrap() = Some(canonical.clone());
    Ok(canonical)
}

#[tauri::command]
fn get_repo_path(state: State<AppState>) -> Result<String, String> {
    state
        .repo_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No repository selected".to_string())
}

#[tauri::command]
fn list_bookmarks(repo_path: String) -> Result<Vec<jj::Bookmark>, String> {
    jj::list_bookmarks(&repo_path)
}

#[tauri::command]
fn list_workspaces(repo_path: String) -> Result<Vec<jj::Workspace>, String> {
    jj::list_workspaces(&repo_path)
}

#[tauri::command]
fn get_log(repo_path: String) -> Result<Vec<jj::LogEntry>, String> {
    jj::get_log(&repo_path)
}

#[tauri::command]
fn get_diff(repo_path: String, revision: String) -> Result<jj::DiffResult, String> {
    jj::get_diff(&repo_path, &revision)
}

#[tauri::command]
fn get_conflicts(repo_path: String, revision: String) -> Result<Vec<jj::ConflictFile>, String> {
    jj::get_conflicts(&repo_path, &revision)
}

// ── Comment Tauri Commands (VCS-agnostic) ──

#[tauri::command]
fn save_comment(repo_path: String, mut comment: Comment) -> Result<Comment, String> {
    comment.body = sanitize_html(&comment.body);

    let mut store = load_comments(&repo_path);

    if let Some(existing) = store.comments.iter_mut().find(|c| c.id == comment.id) {
        *existing = comment.clone();
    } else {
        store.comments.push(comment.clone());
    }

    save_comments_to_disk(&repo_path, &store)?;
    Ok(comment)
}

#[tauri::command]
fn get_comments(repo_path: String, revision: Option<String>) -> Result<Vec<Comment>, String> {
    let store = load_comments(&repo_path);
    let comments = match revision {
        Some(rev) => store
            .comments
            .into_iter()
            .filter(|c| c.revision == rev)
            .collect(),
        None => store.comments,
    };
    Ok(comments)
}

#[tauri::command]
fn delete_comment(repo_path: String, comment_id: String) -> Result<(), String> {
    let mut store = load_comments(&repo_path);
    store.comments.retain(|c| c.id != comment_id);
    save_comments_to_disk(&repo_path, &store)
}

#[tauri::command]
fn resolve_comment(repo_path: String, comment_id: String) -> Result<(), String> {
    let mut store = load_comments(&repo_path);
    if let Some(comment) = store.comments.iter_mut().find(|c| c.id == comment_id) {
        comment.resolved = !comment.resolved;
    }
    save_comments_to_disk(&repo_path, &store)
}

#[tauri::command]
fn export_comments_for_agent(
    repo_path: String,
    revision: String,
) -> Result<AgentExport, String> {
    let diff = jj::get_diff(&repo_path, &revision)?;
    let store = load_comments(&repo_path);
    let rev_comments: Vec<Comment> = store
        .comments
        .into_iter()
        .filter(|c| c.revision == revision && !c.resolved)
        .collect();

    let mut by_file: HashMap<String, Vec<&Comment>> = HashMap::new();
    for c in &rev_comments {
        by_file.entry(c.file_path.clone()).or_default().push(c);
    }

    let mut summary_lines = Vec::new();
    summary_lines.push(format!("# Review Comments for revision {}", revision));
    summary_lines.push(format!("Repository: {}", repo_path));
    summary_lines.push(format!("Total comments: {}", rev_comments.len()));
    summary_lines.push(String::new());

    for (file, comments) in &by_file {
        summary_lines.push(format!("## {}", file));
        for c in comments {
            summary_lines.push(format!(
                "- **Line {} ({})** [{}]: {}",
                c.line, c.side, c.severity, c.body
            ));
        }
        summary_lines.push(String::new());
    }

    let now = chrono::Utc::now().to_rfc3339();

    Ok(AgentExport {
        repo_path,
        revision,
        timestamp: now,
        patch: diff.patch,
        comments: rev_comments,
        summary: summary_lines.join("\n"),
    })
}

// ── App Entry ──

pub fn run() {
    let repos = load_repos_from_disk();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            repo_path: Mutex::new(None),
            repos: Mutex::new(repos),
            active_repo: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // Multi-repo commands
            add_repo,
            remove_repo,
            list_repos,
            set_active_repo,
            // Git commands
            git_list_branches,
            git_detect_base_branch,
            git_get_log,
            git_get_diff,
            get_branch_status,
            mark_reviewed,
            // Graphite commands
            get_stacks,
            get_stack_diff,
            // Claude API commands
            set_claude_key,
            get_claude_key,
            call_claude,
            apply_proposed_changes,
            // Legacy jj commands
            set_repo_path,
            get_repo_path,
            list_bookmarks,
            list_workspaces,
            get_log,
            get_diff,
            get_conflicts,
            // Comment commands
            save_comment,
            get_comments,
            delete_comment,
            resolve_comment,
            export_comments_for_agent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
