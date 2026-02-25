use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

use super::git;

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphiteConfig {
    pub trunk: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphiteBranchMeta {
    pub parent_branch: String,
    pub parent_revision: String,
    pub pr_number: Option<u32>,
    pub pr_title: Option<String>,
    pub pr_state: Option<String>,
    pub pr_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackEntry {
    pub branch_name: String,
    pub meta: GraphiteBranchMeta,
    pub commit_hash: String,
    pub needs_attention: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stack {
    pub id: String,
    pub entries: Vec<StackEntry>,
}

pub fn read_graphite_config(repo_path: &str) -> Result<GraphiteConfig, String> {
    let config_path = Path::new(repo_path)
        .join(".git")
        .join(".graphite_repo_config");

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read Graphite config: {}", e))?;

    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid Graphite config: {}", e))?;

    // Graphite config format: { "main": { "trunk": true } }
    // Find the key whose value has "trunk": true
    let trunk = value
        .as_object()
        .and_then(|obj| {
            obj.iter()
                .find(|(_, val)| val.get("trunk").and_then(|t| t.as_bool()).unwrap_or(false))
                .map(|(key, _)| key.clone())
        })
        .ok_or_else(|| "No trunk branch found in Graphite config".to_string())?;

    Ok(GraphiteConfig { trunk })
}

// ── Branch Metadata ──

pub fn read_branch_meta(
    repo_path: &str,
    branch: &str,
) -> Result<GraphiteBranchMeta, String> {
    let ref_name = format!("refs/branch-metadata/{}", branch);
    let output = git::run_git(repo_path, &["cat-file", "-p", &ref_name])?;

    let value: serde_json::Value =
        serde_json::from_str(output.trim()).map_err(|e| format!("Invalid branch metadata: {}", e))?;

    let parent_branch = value
        .get("parentBranchName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let parent_revision = value
        .get("parentBranchRevision")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Extract PR info if present
    let pr_info = value.get("prInfo");
    let pr_number = pr_info
        .and_then(|p| p.get("number"))
        .and_then(|v| v.as_u64())
        .map(|n| n as u32);
    let pr_title = pr_info
        .and_then(|p| p.get("title"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let pr_state = pr_info
        .and_then(|p| p.get("state"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let pr_url = pr_info
        .and_then(|p| p.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(GraphiteBranchMeta {
        parent_branch,
        parent_revision,
        pr_number,
        pr_title,
        pr_state,
        pr_url,
    })
}

// ── Stack Building ──

pub fn build_stacks(
    repo_path: &str,
    branches: &[super::Branch],
    reviewed_commits: &HashMap<String, String>,
) -> Result<Vec<Stack>, String> {
    let config = read_graphite_config(repo_path)?;

    // Read metadata for all branches
    let mut branch_metas: HashMap<String, GraphiteBranchMeta> = HashMap::new();
    for branch in branches {
        if branch.name == config.trunk {
            continue;
        }
        if let Ok(meta) = read_branch_meta(repo_path, &branch.name) {
            branch_metas.insert(branch.name.clone(), meta);
        }
    }

    // Build adjacency: parent → children
    let mut children: HashMap<String, Vec<String>> = HashMap::new();
    for (name, meta) in &branch_metas {
        children
            .entry(meta.parent_branch.clone())
            .or_default()
            .push(name.clone());
    }

    // Sort children alphabetically for deterministic ordering
    for list in children.values_mut() {
        list.sort();
    }

    // Find root branches (whose parent is trunk)
    let mut roots: Vec<String> = children
        .get(&config.trunk)
        .cloned()
        .unwrap_or_default();
    roots.sort();

    // Build stacks by walking from each root
    let mut stacks = Vec::new();
    for root in &roots {
        let mut entries = Vec::new();
        let mut current = root.clone();

        loop {
            let meta = match branch_metas.get(&current) {
                Some(m) => m.clone(),
                None => break,
            };

            let commit_hash = git::get_branch_tip(repo_path, &current)
                .unwrap_or_default();

            let needs_attention = reviewed_commits
                .get(&current)
                .map_or(true, |reviewed| reviewed != &commit_hash);

            entries.push(StackEntry {
                branch_name: current.clone(),
                meta,
                commit_hash,
                needs_attention,
            });

            // Move to first child (linear stacks)
            match children.get(&current) {
                Some(kids) if !kids.is_empty() => {
                    current = kids[0].clone();
                }
                _ => break,
            }
        }

        if !entries.is_empty() {
            stacks.push(Stack {
                id: root.clone(),
                entries,
            });
        }
    }

    Ok(stacks)
}
