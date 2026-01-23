import { useState } from "react";
import { comments, type Comment } from "../data/mockData";

interface CommentsPanelProps {
  activeTab: "comments" | "claude";
  onTabChange: (tab: "comments" | "claude") => void;
}

function CommentCard({ comment }: { comment: Comment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[#2a2a2a] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#e0e0e0]">{comment.author}</span>
        <span className="text-xs text-[#555]">{comment.date}</span>
      </div>
      <div className="mt-0.5 text-xs text-[#888]">
        <span className="text-[#555]">{comment.file}:{comment.lineRange[0]}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[#e0e0e0]">{comment.body}</p>
      {comment.fixedByClaudeSuggestion && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-[#4e9af5] hover:underline"
          >
            {expanded ? "Hide" : "Show"} Claude fix
          </button>
          {expanded && (
            <div className="mt-1 font-mono text-[10px]">
              <div className="bg-[#2e1a1a] px-2 py-0.5 text-[#f85149]">
                - {comment.fixedByClaudeSuggestion.before}
              </div>
              <div className="bg-[#1a2e1a] px-2 py-0.5 text-[#3fb950]">
                + {comment.fixedByClaudeSuggestion.after}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentsTab() {
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const pending = comments.filter((c) => c.status === "pending");
  const resolved = comments.filter((c) => c.status === "resolved");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2">
        <span className="text-xs text-[#888]">Pending ({pending.length})</span>
      </div>
      {pending.map((c) => (
        <CommentCard key={c.id} comment={c} />
      ))}

      <div className="px-3 py-2">
        <button
          onClick={() => setResolvedExpanded(!resolvedExpanded)}
          className="flex items-center gap-1 text-xs text-[#888] hover:text-[#e0e0e0]"
        >
          <span className="text-[10px]">{resolvedExpanded ? "\u25BC" : "\u25B6"}</span>
          Resolved ({resolved.length})
        </button>
      </div>
      {resolvedExpanded &&
        resolved.map((c) => (
          <CommentCard key={c.id} comment={c} />
        ))}
    </div>
  );
}

function ClaudeTab() {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="text-xs text-[#888]">
        <p className="text-[#e0e0e0]">Review Summary</p>
        <p className="mt-2 leading-relaxed">
          This PR adds Redis-backed session management, replacing the legacy cookie-based approach.
          The implementation looks solid overall. A few concerns:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Input sanitization in login handler needs attention</li>
          <li>Session TTL should be configurable (resolved)</li>
          <li>Rate limiting import is unused — consider removing or implementing</li>
          <li>Good test coverage for the new session flow</li>
        </ul>
        <p className="mt-3 text-[#555]">1 issue auto-fixed via suggestion</p>
      </div>
    </div>
  );
}

export function CommentsPanel({ activeTab, onTabChange }: CommentsPanelProps) {
  const pendingCount = comments.filter((c) => c.status === "pending").length;

  return (
    <div className="flex h-full w-[320px] flex-col border-l border-[#2a2a2a] bg-[#1a1a1a]">
      <div className="flex border-b border-[#2a2a2a]">
        <button
          onClick={() => onTabChange("comments")}
          className={`flex-1 px-3 py-2 text-xs ${
            activeTab === "comments"
              ? "border-b border-[#4e9af5] text-[#e0e0e0]"
              : "text-[#888] hover:text-[#e0e0e0]"
          }`}
        >
          Comments
          {pendingCount > 0 && (
            <span className="ml-1 text-[#4e9af5]">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => onTabChange("claude")}
          className={`flex-1 px-3 py-2 text-xs ${
            activeTab === "claude"
              ? "border-b border-[#4e9af5] text-[#e0e0e0]"
              : "text-[#888] hover:text-[#e0e0e0]"
          }`}
        >
          Claude
        </button>
      </div>

      {activeTab === "comments" ? <CommentsTab /> : <ClaudeTab />}
    </div>
  );
}
