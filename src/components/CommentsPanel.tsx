import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "../routes/__root";
import {
  commentsQuery,
  useSaveComment,
  useDeleteComment,
  useResolveComment,
} from "../api/queries";
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
  const { activeRepoPath, selectedBranch } = useAppContext();

  const { data: fetchedComments = [] } = useQuery({
    ...commentsQuery(activeRepoPath!, selectedBranch!),
    enabled: !propComments && !!activeRepoPath && !!selectedBranch,
  });

  const comments = propComments ?? fetchedComments;

  const saveMutation = useSaveComment(
    activeRepoPath ?? "",
    selectedBranch ?? "",
  );
  const deleteMutation = useDeleteComment(
    activeRepoPath ?? "",
    selectedBranch ?? "",
  );
  const resolveMutation = useResolveComment(
    activeRepoPath ?? "",
    selectedBranch ?? "",
  );

  const [newBody, setNewBody] = useState("");
  const [newSeverity, setNewSeverity] = useState<
    "note" | "nit" | "issue" | "question"
  >("note");

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
    if (!newBody.trim() || !activeRepoPath || !selectedBranch) return;
    const comment: Comment = {
      id: crypto.randomUUID(),
      revision: selectedBranch,
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Comments</h2>
          <p className="text-xs text-text-muted">
            {unresolvedCount} unresolved &middot; {comments.length} total
          </p>
        </div>
      </div>

      {/* Add Comment Form */}
      {selectedBranch && (
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
            {selectedBranch
              ? "No comments yet. Click a line in the diff to start reviewing."
              : "Select a branch to start reviewing."}
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
    </div>
  );
}
