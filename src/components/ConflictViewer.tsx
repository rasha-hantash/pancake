import { useState, useMemo } from "react";
import type { ConflictFile } from "../api/types";

interface ConflictViewerProps {
  conflicts: ConflictFile[];
}

type MarkerType =
  | "start"
  | "separator"
  | "end"
  | "diff-start"
  | "diff-del"
  | "diff-add"
  | null;

function getMarkerType(line: string): MarkerType {
  if (line.startsWith("<<<<<<<")) return "start";
  if (line.startsWith(">>>>>>>")) return "end";
  if (line.startsWith("=======")) return "separator";
  if (line.startsWith("|||||||")) return "separator";
  if (line.startsWith("%%%%%%%")) return "diff-start";
  if (line.startsWith("-------")) return "diff-del";
  if (line.startsWith("+++++++")) return "diff-add";
  return null;
}

function markerColor(type: MarkerType): string {
  switch (type) {
    case "start":
    case "end":
      return "bg-danger/20 text-danger border-l-2 border-danger";
    case "separator":
      return "bg-warning/20 text-warning border-l-2 border-warning";
    case "diff-start":
      return "bg-accent/20 text-accent border-l-2 border-accent";
    case "diff-del":
      return "bg-danger/10 text-danger/80 border-l-2 border-danger/50";
    case "diff-add":
      return "bg-success/10 text-success/80 border-l-2 border-success/50";
    default:
      return "";
  }
}

export function ConflictViewer({ conflicts }: ConflictViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const selectedConflict = useMemo(
    () =>
      conflicts.find((c) => c.path === selectedFile) ?? conflicts[0] ?? null,
    [conflicts, selectedFile],
  );

  if (conflicts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        No conflicts in this revision
      </div>
    );
  }

  const lines = selectedConflict?.content.split("\n") ?? [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* File tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border bg-surface overflow-x-auto">
        {conflicts.map((conflict) => (
          <button
            key={conflict.path}
            onClick={() => setSelectedFile(conflict.path)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap ${
              selectedFile === conflict.path ||
              (selectedFile === null && conflict === conflicts[0])
                ? "bg-danger/20 text-danger"
                : "text-text-muted hover:bg-surface-hover hover:text-text"
            }`}
          >
            <span className="mr-1">&#x26A0;</span>
            {conflict.path}
          </button>
        ))}
      </div>

      {/* File content with conflict markers */}
      {selectedConflict && (
        <div className="flex-1 overflow-auto bg-bg">
          <table className="w-full text-xs font-mono">
            <tbody>
              {lines.map((line, i) => {
                const lineNum = i + 1;
                const mt = getMarkerType(line);
                const isMarker =
                  selectedConflict.marker_lines.includes(lineNum);

                return (
                  <tr
                    key={i}
                    className={`hover:bg-surface-hover/50 ${mt ? markerColor(mt) : ""}`}
                  >
                    <td
                      className={`w-12 text-right pr-3 py-0.5 text-text-muted select-none border-r border-border/30 ${isMarker ? "font-bold" : ""}`}
                    >
                      {lineNum}
                    </td>
                    <td
                      className={`pl-4 pr-4 py-0.5 whitespace-pre ${mt ? "font-bold" : "text-text"}`}
                    >
                      {line}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
