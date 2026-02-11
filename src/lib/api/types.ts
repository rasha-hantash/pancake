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

export interface Comment {
  id: string;
  revision: string;
  file_path: string;
  side: string;
  line: number;
  body: string;
  severity: 'note' | 'nit' | 'issue' | 'question';
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
