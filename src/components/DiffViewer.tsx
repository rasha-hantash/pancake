import { useMemo, useState, useCallback } from "react";
import type { Comment } from "../api/types";

interface DiffViewerProps {
  patch: string;
  comments: Comment[];
  onAddComment?: (
    filePath: string,
    line: number,
    side: string,
    body: string,
    severity: Comment["severity"],
  ) => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface DiffLine {
  type: "header" | "hunk" | "added" | "removed" | "context" | "file-header";
  content: string;
  newLineNum?: number;
  oldLineNum?: number;
}

function parsePatch(patch: string): { fileName: string; lines: DiffLine[] }[] {
  if (!patch.trim()) return [];

  const files: { fileName: string; lines: DiffLine[] }[] = [];
  let currentFile: { fileName: string; lines: DiffLine[] } | null = null;
  let newLine = 0;
  let oldLine = 0;

  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/b\/(.+)$/);
      currentFile = { fileName: match?.[1] ?? "unknown", lines: [] };
      files.push(currentFile);
      currentFile.lines.push({ type: "file-header", content: line });
    } else if (!currentFile) {
      continue;
    } else if (
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++")
    ) {
      currentFile.lines.push({ type: "header", content: line });
    } else if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      if (match) {
        oldLine = parseInt(match[1], 10) - 1;
        newLine = parseInt(match[2], 10) - 1;
      }
      currentFile.lines.push({ type: "hunk", content: line });
    } else if (line.startsWith("+")) {
      newLine++;
      currentFile.lines.push({
        type: "added",
        content: line.slice(1),
        newLineNum: newLine,
      });
    } else if (line.startsWith("-")) {
      oldLine++;
      currentFile.lines.push({
        type: "removed",
        content: line.slice(1),
        oldLineNum: oldLine,
      });
    } else {
      newLine++;
      oldLine++;
      currentFile.lines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        newLineNum: newLine,
        oldLineNum: oldLine,
      });
    }
  }

  return files;
}

function lineClass(type: DiffLine["type"]): string {
  switch (type) {
    case "added":
      return "bg-success/10 text-success";
    case "removed":
      return "bg-danger/10 text-danger";
    case "hunk":
      return "bg-accent/10 text-accent";
    case "file-header":
    case "header":
      return "text-text-muted";
    default:
      return "text-text";
  }
}

function linePrefix(type: DiffLine["type"]): string {
  switch (type) {
    case "added":
      return "+";
    case "removed":
      return "-";
    default:
      return " ";
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case "issue":
      return "border-danger bg-danger/10";
    case "question":
      return "border-warning bg-warning/10";
    case "nit":
      return "border-accent bg-accent/10";
    default:
      return "border-accent bg-accent/10";
  }
}

function severityTextColor(severity: string): string {
  switch (severity) {
    case "issue":
      return "text-danger";
    case "question":
      return "text-warning";
    default:
      return "text-accent";
  }
}

interface InlineCommentFormProps {
  onSubmit: (body: string, severity: Comment["severity"]) => void;
  onCancel: () => void;
}

function InlineCommentForm({ onSubmit, onCancel }: InlineCommentFormProps) {
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Comment["severity"]>("note");

  function handleSubmit() {
    if (!body.trim()) return;
    onSubmit(body.trim(), severity);
  }

  return (
    <div className="mx-4 my-2 p-3 bg-surface border border-border rounded-md">
      <div className="flex gap-2 mb-2">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Comment["severity"])}
          className="bg-bg border border-border rounded text-xs text-text px-2 py-1 focus:outline-none focus:border-accent"
        >
          <option value="note">Note</option>
          <option value="nit">Nit</option>
          <option value="issue">Issue</option>
          <option value="question">Question</option>
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment..."
        rows={2}
        autoFocus
        className="w-full bg-bg border border-border rounded text-sm text-text px-3 py-2 focus:outline-none focus:border-accent resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            handleSubmit();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-text-muted">
          Cmd+Enter to submit, Esc to cancel
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs text-text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!body.trim()}
            className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-medium rounded transition-colors"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}

export function DiffViewer({ patch, comments, onAddComment }: DiffViewerProps) {
  const files = useMemo(() => parsePatch(patch), [patch]);
  const [commentForm, setCommentForm] = useState<{
    file: string;
    line: number;
    side: string;
  } | null>(null);

  const handleLineClick = useCallback(
    (fileName: string, lineNum: number, side: string) => {
      if (!onAddComment) return;
      setCommentForm({ file: fileName, line: lineNum, side });
    },
    [onAddComment],
  );

  if (!patch.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        No changes in this branch
      </div>
    );
  }

  // Group comments by file
  const commentsByFile = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) {
      if (!map[c.file_path]) map[c.file_path] = [];
      map[c.file_path].push(c);
    }
    return map;
  }, [comments]);

  return (
    <div className="flex-1 overflow-auto bg-bg">
      {files.map((file, fi) => {
        const fileComments = commentsByFile[file.fileName] ?? [];

        return (
          <div key={fi} className="mb-0.5">
            {/* File header */}
            <div className="sticky top-0 z-10 px-4 py-2 bg-surface border-b border-border font-mono text-xs text-text flex items-center gap-2">
              <span className="font-medium">{file.fileName}</span>
              {fileComments.length > 0 && (
                <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  {fileComments.filter((c) => !c.resolved).length} comments
                </span>
              )}
            </div>

            {/* Lines */}
            <table className="w-full text-xs font-mono border-collapse">
              <tbody>
                {file.lines
                  .filter((l) => l.type !== "file-header")
                  .map((line, li) => {
                    const isCommentable =
                      line.type === "added" || line.type === "context";
                    const lineNum = line.newLineNum ?? 0;
                    const side = line.type === "removed" ? "old" : "new";

                    const lineComments = isCommentable
                      ? fileComments.filter(
                          (c) => c.line === lineNum && c.side === "new",
                        )
                      : [];

                    const showForm =
                      commentForm &&
                      commentForm.file === file.fileName &&
                      commentForm.line === lineNum &&
                      commentForm.side === side &&
                      isCommentable;

                    return (
                      <tr key={li}>
                        <td className="w-full">
                          <div
                            className={`group flex ${lineClass(line.type)} hover:brightness-110 relative`}
                          >
                            {/* Comment gutter button */}
                            {isCommentable && onAddComment && (
                              <button
                                onClick={() =>
                                  handleLineClick(file.fileName, lineNum, side)
                                }
                                className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-accent hover:text-accent-hover"
                                title="Add comment"
                              >
                                +
                              </button>
                            )}
                            <span className="w-4 shrink-0 select-none text-center text-text-muted">
                              {line.type === "added" || line.type === "removed"
                                ? linePrefix(line.type)
                                : ""}
                            </span>
                            <span className="w-10 shrink-0 select-none text-right pr-2 text-text-muted/50">
                              {line.newLineNum ?? ""}
                            </span>
                            <span className="flex-1 whitespace-pre px-2 py-px">
                              {line.type === "hunk"
                                ? line.content
                                : escapeHtml(line.content)}
                            </span>
                          </div>

                          {/* Inline comments */}
                          {lineComments.map((c) => (
                            <div
                              key={c.id}
                              className={`mx-4 my-1 px-3 py-2 rounded border-l-3 ${severityColor(c.severity)} ${c.resolved ? "opacity-50" : ""}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-[10px] font-semibold uppercase ${severityTextColor(c.severity)}`}
                                >
                                  {c.severity}
                                  {c.resolved ? " \u2713" : ""}
                                </span>
                              </div>
                              <p className="text-xs text-text">
                                {escapeHtml(c.body)}
                              </p>
                            </div>
                          ))}

                          {/* Inline comment form */}
                          {showForm && (
                            <InlineCommentForm
                              onSubmit={(body, severity) => {
                                onAddComment!(
                                  file.fileName,
                                  lineNum,
                                  side,
                                  body,
                                  severity,
                                );
                                setCommentForm(null);
                              }}
                              onCancel={() => setCommentForm(null)}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
