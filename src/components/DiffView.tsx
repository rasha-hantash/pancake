import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import { diffFiles, comments, type DiffFile, type DiffLine } from "../data/mockData";

hljs.registerLanguage("typescript", typescript);

interface DiffViewProps {
  selectedFile: string;
}

function highlightCode(content: string): string {
  if (!content.trim()) return "";
  try {
    return hljs.highlight(content, { language: "typescript" }).value;
  } catch {
    return content;
  }
}

function getLineBg(type: DiffLine["type"]): string {
  switch (type) {
    case "added":
      return "bg-[#1a2e1a]";
    case "removed":
      return "bg-[#2e1a1a]";
    default:
      return "";
  }
}

function getLineNumColor(type: DiffLine["type"]): string {
  switch (type) {
    case "added":
      return "text-[#3fb950]";
    case "removed":
      return "text-[#f85149]";
    default:
      return "text-[#555]";
  }
}

function getLinePrefix(type: DiffLine["type"]): string {
  switch (type) {
    case "added":
      return "+";
    case "removed":
      return "-";
    default:
      return " ";
  }
}

export function DiffView({ selectedFile }: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const file: DiffFile | undefined = diffFiles[selectedFile];

  useEffect(() => {
    containerRef.current?.scrollTo(0, 0);
  }, [selectedFile]);

  if (!file) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[#141414]">
        <span className="text-xs text-[#555]">Select a file to view diff</span>
      </div>
    );
  }

  const totalAdded = file.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.type === "added").length,
    0
  );
  const totalRemoved = file.hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.type === "removed").length,
    0
  );

  const fileComments = comments.filter((c) => c.file === selectedFile && c.status === "resolved");

  return (
    <div ref={containerRef} className="flex h-full flex-1 flex-col overflow-y-auto bg-[#141414]">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2">
        <span className="font-mono text-xs text-[#e0e0e0]">{file.path}</span>
        <span
          className={`text-xs ${
            file.status === "added" ? "text-[#3fb950]" : "text-[#4e9af5]"
          }`}
        >
          {file.status}
        </span>
        <span className="ml-auto text-xs">
          <span className="text-[#3fb950]">+{totalAdded}</span>
          {totalRemoved > 0 && (
            <span className="ml-1 text-[#f85149]">-{totalRemoved}</span>
          )}
        </span>
      </div>

      <div className="font-mono text-xs">
        {file.hunks.map((hunk, hunkIdx) => (
          <div key={hunkIdx}>
            <div className="bg-[#1e2a3a] px-4 py-0.5 text-[#4e9af5]">
              {hunk.header}
            </div>
            {hunk.lines.map((line, lineIdx) => {
              const comment = fileComments.find(
                (c) => line.lineNumber !== null && line.lineNumber >= c.lineRange[0] && line.lineNumber <= c.lineRange[1]
              );
              return (
                <div key={lineIdx}>
                  <div className={`flex ${getLineBg(line.type)}`}>
                    <span
                      className={`w-10 shrink-0 select-none px-2 text-right ${getLineNumColor(line.type)}`}
                    >
                      {line.lineNumber ?? ""}
                    </span>
                    <span className={`w-4 shrink-0 select-none text-center ${getLineNumColor(line.type)}`}>
                      {getLinePrefix(line.type)}
                    </span>
                    <span
                      className="flex-1 whitespace-pre px-2 text-[#e0e0e0]"
                      dangerouslySetInnerHTML={{ __html: highlightCode(line.content) }}
                    />
                  </div>
                  {comment && line.lineNumber === comment.lineRange[1] && (
                    <div className="border-l-2 border-[#3fb950] bg-[#1a2e1a] mx-4 my-1 px-3 py-1.5">
                      <span className="mr-2 text-[10px] text-[#3fb950]">resolved</span>
                      <span className="text-xs text-[#888]">{comment.body}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
