use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub name: String,
    pub change_id: String,
    pub commit_id: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub name: String,
    pub change_id: String,
    pub commit_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub change_id: String,
    pub commit_id: String,
    pub author: String,
    pub timestamp: String,
    pub description: String,
    pub bookmarks: Vec<String>,
    pub is_working_copy: bool,
    pub has_conflict: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub revision: String,
    pub description: String,
    pub patch: String,
    pub files_changed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictFile {
    pub path: String,
    pub content: String,
    pub marker_lines: Vec<usize>,
}

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

fn run_jj(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("jj")
        .args(args)
        .arg("--no-pager")
        .arg("--color=never")
        .current_dir(repo_path)
        .env("NO_COLOR", "1")
        .output()
        .map_err(|e| format!("Failed to run jj: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Some jj commands write warnings to stderr but still succeed
        if output.stdout.is_empty() {
            return Err(format!("jj error: {}", stderr));
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn get_comments_path(repo_path: &str) -> PathBuf {
    let hash = format!("{:x}", md5_hash(repo_path));
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pancake")
        .join("comments");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join(format!("{}.json", hash))
}

fn md5_hash(input: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish()
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

// ── Tauri Commands ──

#[tauri::command]
fn set_repo_path(path: String, state: State<AppState>) -> Result<String, String> {
    // Verify it's a jj repo
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
fn list_bookmarks(repo_path: String) -> Result<Vec<Bookmark>, String> {
    let output = run_jj(
        &repo_path,
        &[
            "bookmark",
            "list",
            "--template",
            r#"name ++ "\t" ++ normal_target.commit_id().short(12) ++ "\t" ++ normal_target.change_id().short(12) ++ "\t" ++ normal_target.description().first_line() ++ "\n""#,
        ],
    )?;

    let bookmarks: Vec<Bookmark> = output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, '\t').collect();
            if parts.len() >= 3 {
                Some(Bookmark {
                    name: parts[0].to_string(),
                    commit_id: parts.get(1).unwrap_or(&"").to_string(),
                    change_id: parts.get(2).unwrap_or(&"").to_string(),
                    description: parts.get(3).unwrap_or(&"").to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(bookmarks)
}

#[tauri::command]
fn list_workspaces(repo_path: String) -> Result<Vec<Workspace>, String> {
    let output = run_jj(&repo_path, &["workspace", "list"])?;

    let workspaces: Vec<Workspace> = output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            // Format: "name: change_id commit_id description"
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                let rest = parts[1].trim();
                let tokens: Vec<&str> = rest.split_whitespace().collect();
                Some(Workspace {
                    name: parts[0].trim().to_string(),
                    change_id: tokens.first().unwrap_or(&"").to_string(),
                    commit_id: tokens.get(1).unwrap_or(&"").to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(workspaces)
}

#[tauri::command]
fn get_log(repo_path: String) -> Result<Vec<LogEntry>, String> {
    let output = run_jj(
        &repo_path,
        &[
            "log",
            "--limit",
            "100",
            "--template",
            r#"change_id.short(12) ++ "\t" ++ commit_id.short(12) ++ "\t" ++ author.email() ++ "\t" ++ committer.timestamp().ago() ++ "\t" ++ if(conflict, "CONFLICT", "") ++ "\t" ++ bookmarks.join(",") ++ "\t" ++ if(current_working_copy, "@", "") ++ "\t" ++ description.first_line() ++ "\n""#,
        ],
    )?;

    let entries: Vec<LogEntry> = output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            // Strip leading graph characters (│ ◆ @ ├ etc.)
            let cleaned = line
                .trim_start_matches(|c: char| !c.is_ascii_alphanumeric())
                .trim();
            let parts: Vec<&str> = cleaned.splitn(8, '\t').collect();
            if parts.len() >= 7 {
                Some(LogEntry {
                    change_id: parts[0].to_string(),
                    commit_id: parts[1].to_string(),
                    author: parts[2].to_string(),
                    timestamp: parts[3].to_string(),
                    has_conflict: parts[4] == "CONFLICT",
                    bookmarks: parts[5]
                        .split(',')
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                        .collect(),
                    is_working_copy: parts[6] == "@",
                    description: parts.get(7).unwrap_or(&"").to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
fn get_diff(repo_path: String, revision: String) -> Result<DiffResult, String> {
    let patch = run_jj(&repo_path, &["diff", "-r", &revision, "--git"])?;

    let desc_output = run_jj(
        &repo_path,
        &[
            "log",
            "-r",
            &revision,
            "--no-graph",
            "--template",
            r#"description.first_line()"#,
        ],
    )?;

    // Extract changed file paths from the diff
    let files_changed: Vec<String> = patch
        .lines()
        .filter(|l| l.starts_with("diff --git"))
        .filter_map(|l| l.split(" b/").last().map(|s| s.to_string()))
        .collect();

    Ok(DiffResult {
        revision: revision.clone(),
        description: desc_output.trim().to_string(),
        patch,
        files_changed,
    })
}

#[tauri::command]
fn get_conflicts(repo_path: String, revision: String) -> Result<Vec<ConflictFile>, String> {
    // Try to list conflicts
    let output = run_jj(&repo_path, &["resolve", "--list", "-r", &revision]);

    let conflict_paths: Vec<String> = match output {
        Ok(text) => text
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                // Format varies, but typically: "path    conflict-type"
                line.split_whitespace().next().map(|s| s.to_string())
            })
            .collect(),
        Err(_) => Vec::new(),
    };

    let mut conflicts = Vec::new();
    for file_path in &conflict_paths {
        // Show the file content with conflict markers
        let content = run_jj(
            &repo_path,
            &["file", "show", "-r", &revision, file_path],
        )
        .unwrap_or_default();

        let marker_lines: Vec<usize> = content
            .lines()
            .enumerate()
            .filter(|(_, l)| {
                l.starts_with("<<<<<<<")
                    || l.starts_with(">>>>>>>")
                    || l.starts_with("=======")
                    || l.starts_with("|||||||")
                    || l.starts_with("%%%%%%%")
                    || l.starts_with("+++++++")
                    || l.starts_with("-------")
            })
            .map(|(i, _)| i + 1)
            .collect();

        conflicts.push(ConflictFile {
            path: file_path.clone(),
            content,
            marker_lines,
        });
    }

    Ok(conflicts)
}

#[tauri::command]
fn save_comment(repo_path: String, comment: Comment) -> Result<Comment, String> {
    let mut store = load_comments(&repo_path);

    // Upsert
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
    let diff = get_diff(repo_path.clone(), revision.clone())?;
    let store = load_comments(&repo_path);
    let rev_comments: Vec<Comment> = store
        .comments
        .into_iter()
        .filter(|c| c.revision == revision && !c.resolved)
        .collect();

    // Group by file
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
