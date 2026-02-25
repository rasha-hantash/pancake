import { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../routes/__root";
import { useCallClaude, useApplyProposedChanges } from "../api/queries";
import { getClaudeKey } from "../api/tauri";
import { ApiKeyModal } from "./ApiKeyModal";
import type { Comment, ClaudeResponse } from "../api/types";

interface ClaudePanelProps {
  comments: Comment[];
}

export function ClaudePanel({ comments }: ClaudePanelProps) {
  const { activeRepoPath, selectedBranch, diffBaseOverride } = useAppContext();

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [result, setResult] = useState<ClaudeResponse | null>(null);

  const unresolvedCount = useMemo(
    () => comments.filter((c) => !c.resolved).length,
    [comments],
  );

  const claudeMutation = useCallClaude(
    activeRepoPath ?? "",
    selectedBranch ?? "",
    diffBaseOverride ?? undefined,
  );

  const applyMutation = useApplyProposedChanges(
    activeRepoPath ?? "",
    selectedBranch ?? "",
  );

  // Check for API key on mount and when modal closes
  useEffect(() => {
    getClaudeKey().then((k) => setHasKey(!!k));
  }, [showKeyModal]);

  function handleSendToClaude() {
    setResult(null);
    claudeMutation.mutate(undefined, {
      onSuccess: (data) => setResult(data),
    });
  }

  function handleApply() {
    if (!result?.proposed_diff) return;
    applyMutation.mutate(result.proposed_diff, {
      onSuccess: () => setResult(null),
    });
  }

  function handleDismiss() {
    setResult(null);
    claudeMutation.reset();
  }

  const canSend =
    hasKey &&
    !!activeRepoPath &&
    !!selectedBranch &&
    unresolvedCount > 0 &&
    !claudeMutation.isPending;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Claude Review</h2>
          <p className="text-xs text-text-muted">
            {hasKey ? "Ready" : "API key required"}
            {hasKey &&
              ` \u00B7 ${unresolvedCount} unresolved comment${unresolvedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowKeyModal(true)}
          className="p-1.5 hover:bg-surface-hover rounded text-text-muted hover:text-text transition-colors"
          title="Configure API key"
        >
          <span className="text-sm">&#x2699;</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasKey ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted mb-3">
              Configure your Anthropic API key to enable Claude-powered code
              review.
            </p>
            <button
              onClick={() => setShowKeyModal(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors"
            >
              Set API Key
            </button>
          </div>
        ) : !selectedBranch ? (
          <div className="text-center py-8 text-sm text-text-muted">
            Select a branch to start reviewing.
          </div>
        ) : claudeMutation.isPending ? (
          <div className="text-center py-8">
            <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-text-muted">
              Sending diff and comments to Claude...
            </p>
            <p className="text-xs text-text-muted mt-1">
              This may take a moment.
            </p>
          </div>
        ) : claudeMutation.isError ? (
          <div className="py-4">
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-md mb-3">
              <p className="text-xs font-semibold text-danger mb-1">Error</p>
              <p className="text-xs text-text">
                {String(claudeMutation.error)}
              </p>
            </div>
            <button
              onClick={handleSendToClaude}
              className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        ) : result ? (
          <div>
            {/* Explanation */}
            {result.explanation && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Explanation
                </h3>
                <div className="p-3 bg-bg border border-border rounded-md text-sm text-text whitespace-pre-wrap leading-relaxed">
                  {result.explanation}
                </div>
              </div>
            )}

            {/* Proposed Diff */}
            {result.proposed_diff ? (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Proposed Changes
                </h3>
                <div className="bg-bg border border-accent/30 rounded-md overflow-hidden">
                  <pre className="p-3 text-xs font-mono overflow-x-auto leading-relaxed">
                    {result.proposed_diff.split("\n").map((line, i) => {
                      let cls = "text-text";
                      if (line.startsWith("+") && !line.startsWith("+++")) {
                        cls = "text-success bg-success/10";
                      } else if (
                        line.startsWith("-") &&
                        !line.startsWith("---")
                      ) {
                        cls = "text-danger bg-danger/10";
                      } else if (line.startsWith("@@")) {
                        cls = "text-accent bg-accent/10";
                      } else if (line.startsWith("diff --git")) {
                        cls = "text-text-muted font-semibold";
                      }
                      return (
                        <div key={i} className={cls}>
                          {line}
                        </div>
                      );
                    })}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-md mb-4">
                <p className="text-xs text-warning">
                  Claude did not produce an applicable diff. Review the
                  explanation above.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {result.proposed_diff && (
                <button
                  onClick={handleApply}
                  disabled={applyMutation.isPending}
                  className="flex-1 px-4 py-2 bg-success hover:bg-success/80 disabled:opacity-40 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {applyMutation.isPending ? "Applying..." : "Apply Changes"}
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2 bg-bg border border-border hover:bg-surface-hover text-text text-sm font-medium rounded-md transition-colors"
              >
                Dismiss
              </button>
            </div>

            {applyMutation.isError && (
              <div className="mt-3 p-3 bg-danger/10 border border-danger/30 rounded-md">
                <p className="text-xs text-danger">
                  Failed to apply: {String(applyMutation.error)}
                </p>
              </div>
            )}

            {/* Model info */}
            <p className="text-xs text-text-muted mt-3 text-center">
              Model: {result.model}
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted mb-4">
              {unresolvedCount > 0
                ? `Send ${unresolvedCount} unresolved comment${unresolvedCount !== 1 ? "s" : ""} and the current diff to Claude for automated resolution.`
                : "No unresolved comments to send to Claude."}
            </p>
            <button
              onClick={handleSendToClaude}
              disabled={!canSend}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              Send to Claude
            </button>
          </div>
        )}
      </div>

      <ApiKeyModal open={showKeyModal} onClose={() => setShowKeyModal(false)} />
    </div>
  );
}
