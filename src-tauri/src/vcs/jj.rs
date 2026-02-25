use serde::{Deserialize, Serialize};
use std::process::Command;

// ── jj-specific types ──

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

// ── Helpers ──

pub fn run_jj(repo_path: &str, args: &[&str]) -> Result<String, String> {
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
        if output.stdout.is_empty() {
            return Err(format!("jj error: {}", stderr));
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Strip jj graph drawing characters from the start of a log line.
/// Preserves Unicode in commit messages, author names, and branch names.
fn strip_graph_chars(line: &str) -> &str {
    let graph_chars: &[char] = &[
        '│', '◆', '◯', '├', '╷', '╶', '─', '╭', '╰', '╮', '╯', '┤', '┼',
        '|', ' ', '○', '●', '◉', '~',
    ];
    line.trim_start_matches(graph_chars)
}

// ── Commands ──

pub fn list_bookmarks(repo_path: &str) -> Result<Vec<Bookmark>, String> {
    let output = run_jj(
        repo_path,
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

pub fn list_workspaces(repo_path: &str) -> Result<Vec<Workspace>, String> {
    let output = run_jj(repo_path, &["workspace", "list"])?;

    let workspaces: Vec<Workspace> = output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
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

pub fn get_log(repo_path: &str) -> Result<Vec<LogEntry>, String> {
    let output = run_jj(
        repo_path,
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
            let cleaned = strip_graph_chars(line);
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

pub fn get_diff(repo_path: &str, revision: &str) -> Result<DiffResult, String> {
    let patch = run_jj(repo_path, &["diff", "-r", revision, "--git"])?;

    let desc_output = run_jj(
        repo_path,
        &[
            "log",
            "-r",
            revision,
            "--no-graph",
            "--template",
            r#"description.first_line()"#,
        ],
    )?;

    let files_changed: Vec<String> = patch
        .lines()
        .filter(|l| l.starts_with("diff --git"))
        .filter_map(|l| l.split(" b/").last().map(|s| s.to_string()))
        .collect();

    Ok(DiffResult {
        revision: revision.to_string(),
        description: desc_output.trim().to_string(),
        patch,
        files_changed,
    })
}

pub fn get_conflicts(repo_path: &str, revision: &str) -> Result<Vec<ConflictFile>, String> {
    let output = run_jj(repo_path, &["resolve", "--list", "-r", revision]);

    let conflict_paths: Vec<String> = match output {
        Ok(text) => text
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                line.split_whitespace().next().map(|s| s.to_string())
            })
            .collect(),
        Err(_) => Vec::new(),
    };

    let mut conflicts = Vec::new();
    for file_path in &conflict_paths {
        let content = run_jj(
            repo_path,
            &["file", "show", "-r", revision, file_path],
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
