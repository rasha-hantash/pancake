mod vcs;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

// Re-export jj types for backward-compatible Tauri command signatures
use vcs::jj;

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

// ── App State ──

pub struct AppState {
    pub repo_path: Mutex<Option<String>>,
}

// ── Helpers ──

/// Hash repo path using SHA-256 for stable, collision-resistant file naming.
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

/// Sanitize HTML entities in user input for defense-in-depth against XSS.
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

// ── jj Tauri Commands (delegating to vcs::jj) ──

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
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            repo_path: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            set_repo_path,
            get_repo_path,
            list_bookmarks,
            list_workspaces,
            get_log,
            get_diff,
            get_conflicts,
            save_comment,
            get_comments,
            delete_comment,
            resolve_comment,
            export_comments_for_agent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
