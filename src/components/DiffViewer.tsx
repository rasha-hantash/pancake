import { useMemo } from "react";
import type { Comment } from "../api/types";

interface DiffViewerProps {
  patch: string;
  comments: Comment[];
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
  lineNum?: number;
}

function parsePatch(patch: string): { fileName: string; lines: DiffLine[] }[] {
  if (!patch.trim()) return [];

  const files: { fileName: string; lines: DiffLine[] }[] = [];
  let currentFile: { fileName: string; lines: DiffLine[] } | null = null;

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
      currentFile.lines.push({ type: "hunk", content: line });
    } else if (line.startsWith("+")) {
      currentFile.lines.push({ type: "added", content: line.slice(1) });
    } else if (line.startsWith("-")) {
      currentFile.lines.push({ type: "removed", content: line.slice(1) });
    } else {
      currentFile.lines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
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

export function DiffViewer({ patch, comments }: DiffViewerProps) {
  const files = useMemo(() => parsePatch(patch), [patch]);

  if (!patch.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        No changes in this revision
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
        let newLineNum = 0;

        return (
          <div key={fi} className="mb-0.5">
            {/* File header */}
            <div className="sticky top-0 z-10 px-4 py-2 bg-surface border-b border-border font-mono text-xs text-text flex items-center gap-2">
              <span className="font-medium">{file.fileName}</span>
            </div>

            {/* Lines */}
            <table className="w-full text-xs font-mono border-collapse">
              <tbody>
                {file.lines
                  .filter((l) => l.type !== "file-header")
                  .map((line, li) => {
                    // Track line numbers for new side
                    if (line.type === "hunk") {
                      const match = line.content.match(/\+(\d+)/);
                      if (match) newLineNum = parseInt(match[1], 10) - 1;
                    }
                    if (line.type === "added" || line.type === "context") {
                      newLineNum++;
                    }

                    const lineComments =
                      line.type === "added" || line.type === "context"
                        ? fileComments.filter(
                            (c) => c.line === newLineNum && c.side === "new",
                          )
                        : [];

                    return (
                      <tr key={li}>
                        <td className="w-full">
                          <div
                            className={`flex ${lineClass(line.type)} hover:brightness-110`}
                          >
                            <span className="w-4 shrink-0 select-none text-center text-text-muted">
                              {line.type === "added" || line.type === "removed"
                                ? linePrefix(line.type)
                                : ""}
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
