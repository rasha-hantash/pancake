import { invoke } from "@tauri-apps/api/core";
import type {
  Bookmark,
  Workspace,
  LogEntry,
  DiffResult,
  ConflictFile,
  Comment,
  AgentExport,
} from "./types";

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
