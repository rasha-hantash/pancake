import { invoke } from "@tauri-apps/api/core";
import type {
  Bookmark,
  Workspace,
  LogEntry,
  DiffResult,
  ConflictFile,
  Comment,
  AgentExport,
  RepoMeta,
  RepoWithStatus,
  Branch,
  GitLogEntry,
  GitDiffResult,
  BranchStatus,
  Stack,
} from "./types";

// ── Multi-repo commands ──

export async function addRepo(path: string): Promise<RepoMeta> {
  return invoke<RepoMeta>("add_repo", { path });
}

export async function removeRepo(path: string): Promise<void> {
  return invoke<void>("remove_repo", { path });
}

export async function listRepos(): Promise<RepoWithStatus[]> {
  return invoke<RepoWithStatus[]>("list_repos");
}

export async function setActiveRepo(path: string): Promise<void> {
  return invoke<void>("set_active_repo", { path });
}

// ── Git commands ──

export async function gitListBranches(repoPath: string): Promise<Branch[]> {
  return invoke<Branch[]>("git_list_branches", { repoPath });
}

export async function gitDetectBaseBranch(repoPath: string): Promise<string> {
  return invoke<string>("git_detect_base_branch", { repoPath });
}

export async function gitGetLog(
  repoPath: string,
  branch: string,
  baseOverride?: string,
): Promise<GitLogEntry[]> {
  return invoke<GitLogEntry[]>("git_get_log", {
    repoPath,
    branch,
    baseOverride,
  });
}

export async function gitGetDiff(
  repoPath: string,
  branch: string,
  baseOverride?: string,
): Promise<GitDiffResult> {
  return invoke<GitDiffResult>("git_get_diff", {
    repoPath,
    branch,
    baseOverride,
  });
}

export async function getBranchStatus(
  repoPath: string,
  branch: string,
): Promise<BranchStatus> {
  return invoke<BranchStatus>("get_branch_status", { repoPath, branch });
}

export async function markReviewed(
  repoPath: string,
  branch: string,
): Promise<void> {
  return invoke<void>("mark_reviewed", { repoPath, branch });
}

// ── Graphite commands ──

export async function getStacks(repoPath: string): Promise<Stack[]> {
  return invoke<Stack[]>("get_stacks", { repoPath });
}

export async function getStackDiff(
  repoPath: string,
  branch: string,
): Promise<GitDiffResult> {
  return invoke<GitDiffResult>("get_stack_diff", { repoPath, branch });
}

// ── Legacy jj commands ──

export async function setRepoPath(path: string): Promise<string> {
  return invoke<string>("set_repo_path", { path });
}

export async function getRepoPath(): Promise<string> {
  return invoke<string>("get_repo_path");
}

export async function listBookmarks(repoPath: string): Promise<Bookmark[]> {
  return invoke<Bookmark[]>("list_bookmarks", { repoPath });
}

export async function listWorkspaces(repoPath: string): Promise<Workspace[]> {
  return invoke<Workspace[]>("list_workspaces", { repoPath });
}

export async function getLog(repoPath: string): Promise<LogEntry[]> {
  return invoke<LogEntry[]>("get_log", { repoPath });
}

export async function getDiff(
  repoPath: string,
  revision: string,
): Promise<DiffResult> {
  return invoke<DiffResult>("get_diff", { repoPath, revision });
}

export async function getConflicts(
  repoPath: string,
  revision: string,
): Promise<ConflictFile[]> {
  return invoke<ConflictFile[]>("get_conflicts", { repoPath, revision });
}

// ── Comment commands ──

export async function saveComment(
  repoPath: string,
  comment: Comment,
): Promise<Comment> {
  return invoke<Comment>("save_comment", { repoPath, comment });
}

export async function getComments(
  repoPath: string,
  revision?: string,
): Promise<Comment[]> {
  return invoke<Comment[]>("get_comments", { repoPath, revision });
}

export async function deleteComment(
  repoPath: string,
  commentId: string,
): Promise<void> {
  return invoke<void>("delete_comment", { repoPath, commentId });
}

export async function resolveComment(
  repoPath: string,
  commentId: string,
): Promise<void> {
  return invoke<void>("resolve_comment", { repoPath, commentId });
}

export async function exportCommentsForAgent(
  repoPath: string,
  revision: string,
): Promise<AgentExport> {
  return invoke<AgentExport>("export_comments_for_agent", {
    repoPath,
    revision,
  });
}
