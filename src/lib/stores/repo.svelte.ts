import * as api from '../api/tauri.js';
import type { Bookmark, Workspace, LogEntry, DiffResult, ConflictFile, Comment } from '../api/types.js';

// ── Reactive State ──

let repoPath = $state<string | null>(null);
let bookmarks = $state<Bookmark[]>([]);
let workspaces = $state<Workspace[]>([]);
let logEntries = $state<LogEntry[]>([]);
let selectedRevision = $state<string | null>(null);
let currentDiff = $state<DiffResult | null>(null);
let conflicts = $state<ConflictFile[]>([]);
let comments = $state<Comment[]>([]);
let loading = $state(false);
let error = $state<string | null>(null);

// ── Actions ──

export async function selectRepo(path: string) {
  try {
    loading = true;
    error = null;
    const canonical = await api.setRepoPath(path);
    repoPath = canonical;
    await refreshAll();
  } catch (e) {
    error = String(e);
  } finally {
    loading = false;
  }
}

export async function refreshAll() {
  if (!repoPath) return;
  try {
    loading = true;
    error = null;
    const [b, w, l] = await Promise.all([
      api.listBookmarks(repoPath),
      api.listWorkspaces(repoPath),
      api.getLog(repoPath),
    ]);
    bookmarks = b;
    workspaces = w;
    logEntries = l;
    
    // Load comments for current revision if any
    if (selectedRevision) {
      comments = await api.getComments(repoPath, selectedRevision);
    }
  } catch (e) {
    error = String(e);
  } finally {
    loading = false;
  }
}

export async function selectRevision(rev: string) {
  if (!repoPath) return;
  try {
    loading = true;
    error = null;
    selectedRevision = rev;
    const [diff, conf, cmts] = await Promise.all([
      api.getDiff(repoPath, rev),
      api.getConflicts(repoPath, rev).catch(() => [] as ConflictFile[]),
      api.getComments(repoPath, rev),
    ]);
    currentDiff = diff;
    conflicts = conf;
    comments = cmts;
  } catch (e) {
    error = String(e);
  } finally {
    loading = false;
  }
}

export async function addComment(
  filePath: string,
  side: string,
  line: number,
  body: string,
  severity: 'note' | 'nit' | 'issue' | 'question' = 'note',
) {
  if (!repoPath || !selectedRevision) return;
  const comment: Comment = {
    id: crypto.randomUUID(),
    revision: selectedRevision,
    file_path: filePath,
    side,
    line,
    body,
    severity,
    created_at: new Date().toISOString(),
    resolved: false,
  };
  const saved = await api.saveComment(repoPath, comment);
  comments = [...comments, saved];
}

export async function removeComment(commentId: string) {
  if (!repoPath) return;
  await api.deleteComment(repoPath, commentId);
  comments = comments.filter((c) => c.id !== commentId);
}

export async function toggleResolveComment(commentId: string) {
  if (!repoPath) return;
  await api.resolveComment(repoPath, commentId);
  comments = comments.map((c) =>
    c.id === commentId ? { ...c, resolved: !c.resolved } : c,
  );
}

export async function exportForAgent() {
  if (!repoPath || !selectedRevision) return null;
  return api.exportCommentsForAgent(repoPath, selectedRevision);
}

// ── Getters (exported as functions to maintain reactivity) ──

export function getState() {
  return {
    get repoPath() { return repoPath; },
    get bookmarks() { return bookmarks; },
    get workspaces() { return workspaces; },
    get logEntries() { return logEntries; },
    get selectedRevision() { return selectedRevision; },
    get currentDiff() { return currentDiff; },
    get conflicts() { return conflicts; },
    get comments() { return comments; },
    get loading() { return loading; },
    get error() { return error; },
  };
}
