import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "../routes/__root";
import {
  commentsQuery,
  useSaveComment,
  useDeleteComment,
  useResolveComment,
} from "../api/queries";
import { exportCommentsForAgent } from "../api/tauri";
import type { Comment } from "../api/types";

function severityColor(s: string): string {
  switch (s) {
    case "issue":
      return "text-danger";
    case "question":
      return "text-warning";
    default:
      return "text-accent";
  }
}

interface CommentsPanelProps {
  comments?: Comment[];
}

export function CommentsPanel({ comments: propComments }: CommentsPanelProps) {
  const { repoPath, selectedRevision } = useAppContext();

  const { data: fetchedComments = [] } = useQuery({
    ...commentsQuery(repoPath!, selectedRevision!),
    enabled: !propComments && !!repoPath && !!selectedRevision,
  });

  const comments = propComments ?? fetchedComments;

  const saveMutation = useSaveComment(repoPath ?? "", selectedRevision ?? "");
  const deleteMutation = useDeleteComment(
    repoPath ?? "",
    selectedRevision ?? "",
  );
  const resolveMutation = useResolveComment(
    repoPath ?? "",
    selectedRevision ?? "",
  );

  const [newBody, setNewBody] = useState("");
  const [newSeverity, setNewSeverity] = useState<
    "note" | "nit" | "issue" | "question"
  >("note");
  const [exportOutput, setExportOutput] = useState("");
  const [showExport, setShowExport] = useState(false);

  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  // Group comments by file
  const groupedComments: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (!groupedComments[c.file_path]) groupedComments[c.file_path] = [];
    groupedComments[c.file_path].push(c);
  }
  for (const file in groupedComments) {
    groupedComments[file].sort((a, b) => a.line - b.line);
  }

  async function handleAddComment() {
    if (!newBody.trim() || !repoPath || !selectedRevision) return;
    const comment: Comment = {
      id: crypto.randomUUID(),
      revision: selectedRevision,
      file_path: "general",
      side: "new",
      line: 0,
      body: newBody.trim(),
      severity: newSeverity,
      created_at: new Date().toISOString(),
      resolved: false,
    };
    await saveMutation.mutateAsync(comment);
    setNewBody("");
  }

  async function handleExport() {
    if (!repoPath || !selectedRevision) return;
    const result = await exportCommentsForAgent(repoPath, selectedRevision);
    setExportOutput(result.summary);
    setShowExport(true);
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch {
      // Clipboard not available
    }
  }

  return (
    <aside className="w-80 h-full bg-surface border-l border-border flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Comments</h2>
          <p className="text-xs text-text-muted">
            {unresolvedCount} unresolved &middot; {comments.length} total
          </p>
        </div>
        {selectedRevision && (
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-md transition-colors"
          >
            Export
          </button>
        )}
      </div>

      {/* Add Comment Form */}
      {selectedRevision && (
        <div className="p-4 border-b border-border">
          <div className="flex gap-2 mb-2">
            <select
              value={newSeverity}
              onChange={(e) =>
                setNewSeverity(
                  e.target.value as "note" | "nit" | "issue" | "question",
                )
              }
              className="bg-bg border border-border rounded-md text-xs text-text px-2 py-1.5 focus:outline-none focus:border-accent"
            >
              <option value="note">Note</option>
              <option value="nit">Nit</option>
              <option value="issue">Issue</option>
              <option value="question">Question</option>
            </select>
          </div>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Add a review comment..."
            rows={3}
            className="w-full bg-bg border border-border rounded-md text-sm text-text px-3 py-2 focus:outline-none focus:border-accent resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleAddComment();
              }
            }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-text-muted">Cmd+Enter to submit</span>
            <button
              onClick={handleAddComment}
              disabled={!newBody.trim()}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
            >
              Add Comment
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedComments).length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            {selectedRevision
              ? "No comments yet. Click a line in the diff to start reviewing."
              : "Select a revision to start reviewing."}
          </div>
        ) : (
          Object.entries(groupedComments).map(([filePath, fileComments]) => (
            <div key={filePath} className="border-b border-border">
              <div className="px-4 py-2 bg-bg/50">
                <span className="text-xs font-mono text-text-muted truncate block">
                  {filePath}
                </span>
              </div>
              {fileComments.map((comment) => (
                <div
                  key={comment.id}
                  className={`px-4 py-3 border-t border-border/50 ${comment.resolved ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold uppercase ${severityColor(comment.severity)}`}
                      >
                        {comment.severity}
                      </span>
                      <span className="text-xs text-text-muted font-mono">
                        L{comment.line} ({comment.side})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => resolveMutation.mutate(comment.id)}
                        className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-success transition-colors"
                        title={comment.resolved ? "Unresolve" : "Resolve"}
                      >
                        {comment.resolved ? (
                          <span className="text-success text-sm">&#x2713;</span>
                        ) : (
                          <span className="text-sm">&#x25CB;</span>
                        )}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-danger transition-colors"
                        title="Delete"
                      >
                        <span className="text-sm">&#x2715;</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-text leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-text">Agent Export</h3>
              <button
                onClick={() => setShowExport(false)}
                className="text-text-muted hover:text-text"
              >
                &#x2715;
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-bg p-4 rounded-lg text-xs text-text font-mono whitespace-pre-wrap">
              {exportOutput}
            </pre>
            <p className="mt-3 text-xs text-text-muted">
              Full JSON has been copied to clipboard.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
