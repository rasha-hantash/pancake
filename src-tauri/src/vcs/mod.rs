pub mod jj;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VcsBackend {
    Git,
    Jj,
}

/// A branch in the repo (used by git backend).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub name: String,
    pub commit_hash: String,
    pub is_current: bool,
    pub ahead_count: u32,
    pub behind_count: u32,
}

/// A commit log entry (shared across VCS backends).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub commit_id: String,
    pub author: String,
    pub timestamp: String,
    pub description: String,
    pub branches: Vec<String>,
}

/// A diff result for git branch-vs-base comparison.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffResult {
    pub branch: String,
    pub description: String,
    pub patch: String,
    pub files_changed: Vec<String>,
}
