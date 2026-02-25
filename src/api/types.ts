// ── Legacy jj types (preserved for future jj support) ──

export interface Bookmark {
  name: string;
  change_id: string;
  commit_id: string;
  description: string;
}

export interface Workspace {
  name: string;
  change_id: string;
  commit_id: string;
}

export interface LogEntry {
  change_id: string;
  commit_id: string;
  author: string;
  timestamp: string;
  description: string;
  bookmarks: string[];
  is_working_copy: boolean;
  has_conflict: boolean;
}

export interface DiffResult {
  revision: string;
  description: string;
  patch: string;
  files_changed: string[];
}

export interface ConflictFile {
  path: string;
  content: string;
  marker_lines: number[];
}

// ── Git types ──

export type VcsBackend = "Git" | "Jj";

export interface Branch {
  name: string;
  commit_hash: string;
  is_current: boolean;
  ahead_count: number;
  behind_count: number;
}

export interface GitLogEntry {
  commit_id: string;
  author: string;
  timestamp: string;
  description: string;
  branches: string[];
}

export interface GitDiffResult {
  branch: string;
  description: string;
  patch: string;
  files_changed: string[];
}

export interface RepoMeta {
  path: string;
  display_name: string;
  vcs: VcsBackend;
  has_graphite: boolean;
  base_branch: string | null;
}

export interface RepoWithStatus {
  meta: RepoMeta;
  has_any_attention: boolean;
  branch_statuses: Record<string, boolean>;
}

export interface BranchStatus {
  needs_attention: boolean;
  tip_commit: string;
}

// ── Comment types (VCS-agnostic) ──

export interface Comment {
  id: string;
  revision: string;
  file_path: string;
  side: string;
  line: number;
  body: string;
  severity: "note" | "nit" | "issue" | "question";
  created_at: string;
  resolved: boolean;
}

export interface AgentExport {
  repo_path: string;
  revision: string;
  timestamp: string;
  patch: string;
  comments: Comment[];
  summary: string;
}
