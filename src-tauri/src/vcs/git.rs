use std::process::Command;

use super::{Branch, GitDiffResult, GitLogEntry};

// ── Helpers ──

pub fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("--no-pager")
        .arg("-c")
        .arg("color.ui=never")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if output.stdout.is_empty() {
            return Err(format!("git error: {}", stderr));
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ── Detection ──

pub fn detect_base_branch(repo_path: &str) -> Result<String, String> {
    // Try "main" first
    if run_git(repo_path, &["rev-parse", "--verify", "main"]).is_ok() {
        return Ok("main".to_string());
    }
    // Try "master"
    if run_git(repo_path, &["rev-parse", "--verify", "master"]).is_ok() {
        return Ok("master".to_string());
    }
    // Try symbolic ref from origin
    if let Ok(output) = run_git(repo_path, &["symbolic-ref", "refs/remotes/origin/HEAD"]) {
        let trimmed = output.trim();
        if let Some(branch) = trimmed.strip_prefix("refs/remotes/origin/") {
            return Ok(branch.to_string());
        }
    }
    Err("Could not detect base branch".to_string())
}

// ── Branch Operations ──

pub fn list_branches(repo_path: &str) -> Result<Vec<Branch>, String> {
    let base = detect_base_branch(repo_path).unwrap_or_else(|_| "main".to_string());

    let output = run_git(
        repo_path,
        &[
            "branch",
            "--format=%(refname:short)\t%(objectname:short)\t%(HEAD)",
        ],
    )?;

    let mut branches: Vec<Branch> = output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(3, '\t').collect();
            if parts.len() >= 3 {
                let name = parts[0].to_string();
                let commit_hash = parts[1].to_string();
                let is_current = parts[2].trim() == "*";

                // Calculate ahead/behind relative to base branch
                let (ahead, behind) = get_ahead_behind(repo_path, &name, &base);

                Some(Branch {
                    name,
                    commit_hash,
                    is_current,
                    ahead_count: ahead,
                    behind_count: behind,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort: current branch first, then alphabetical
    branches.sort_by(|a, b| b.is_current.cmp(&a.is_current).then(a.name.cmp(&b.name)));

    Ok(branches)
}

fn get_ahead_behind(repo_path: &str, branch: &str, base: &str) -> (u32, u32) {
    let arg = format!("{}...{}", base, branch);
    let output = run_git(
        repo_path,
        &["rev-list", "--left-right", "--count", &arg],
    );

    match output {
        Ok(text) => {
            let parts: Vec<&str> = text.trim().split('\t').collect();
            if parts.len() == 2 {
                let behind = parts[0].parse().unwrap_or(0);
                let ahead = parts[1].parse().unwrap_or(0);
                (ahead, behind)
            } else {
                (0, 0)
            }
        }
        Err(_) => (0, 0),
    }
}

// ── Log ──

pub fn get_log(repo_path: &str, branch: &str, base: &str) -> Result<Vec<GitLogEntry>, String> {
    let merge_base = run_git(repo_path, &["merge-base", base, branch])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    if merge_base.is_empty() {
        return Ok(Vec::new());
    }

    let range = format!("{}..{}", merge_base, branch);
    let output = run_git(
        repo_path,
        &[
            "log",
            "--no-graph",
            "--pretty=format:%H\t%ae\t%ar\t%s\t%D",
            &range,
        ],
    )?;

    let entries: Vec<GitLogEntry> = output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(5, '\t').collect();
            GitLogEntry {
                commit_id: parts.first().unwrap_or(&"").to_string(),
                author: parts.get(1).unwrap_or(&"").to_string(),
                timestamp: parts.get(2).unwrap_or(&"").to_string(),
                description: parts.get(3).unwrap_or(&"").to_string(),
                branches: parts
                    .get(4)
                    .unwrap_or(&"")
                    .split(", ")
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .collect(),
            }
        })
        .collect();

    Ok(entries)
}

// ── Diff ──

pub fn get_diff(
    repo_path: &str,
    branch: &str,
    base: &str,
) -> Result<GitDiffResult, String> {
    let merge_base = run_git(repo_path, &["merge-base", base, branch])
        .map(|s| s.trim().to_string());

    let merge_base = match merge_base {
        Ok(mb) if !mb.is_empty() => mb,
        _ => {
            // Orphan branch or no common ancestor — show full diff from empty tree
            let empty_tree = "4b825dc642cb6eb9a060e54bf899d8b5f04a8e72";
            empty_tree.to_string()
        }
    };

    // Check if this is the current branch (may have uncommitted work)
    let current_branch = run_git(repo_path, &["branch", "--show-current"])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    let patch = if current_branch == branch {
        // Current branch: compare working tree to merge-base
        run_git(repo_path, &["diff", &merge_base])?
    } else {
        // Non-current branch: committed changes only
        let range = format!("{}..{}", merge_base, branch);
        run_git(repo_path, &["diff", &range])?
    };

    // Get branch description (latest commit message)
    let description = run_git(
        repo_path,
        &["log", "-1", "--pretty=format:%s", branch],
    )
    .unwrap_or_default()
    .trim()
    .to_string();

    let files_changed: Vec<String> = patch
        .lines()
        .filter(|l| l.starts_with("diff --git"))
        .filter_map(|l| l.split(" b/").last().map(|s| s.to_string()))
        .collect();

    Ok(GitDiffResult {
        branch: branch.to_string(),
        description,
        patch,
        files_changed,
    })
}

// ── Branch Status ──

pub fn get_branch_tip(repo_path: &str, branch: &str) -> Result<String, String> {
    run_git(repo_path, &["rev-parse", branch]).map(|s| s.trim().to_string())
}
