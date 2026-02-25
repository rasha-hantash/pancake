import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "../components/Sidebar";
import { DiffViewer } from "../components/DiffViewer";
import { CommentsPanel } from "../components/CommentsPanel";
import { ClaudePanel } from "../components/ClaudePanel";
import { useAppContext } from "./__root";
import { useQuery } from "@tanstack/react-query";
import {
  gitDiffQuery,
  commentsQuery,
  stacksQuery,
  useSaveComment,
} from "../api/queries";
import { mockGitDiff, mockComments, mockStacks } from "../data/mockData";
import type { Comment } from "../api/types";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const {
    activeRepoPath,
    selectedBranch,
    diffBaseOverride,
    setSelectedBranch,
    setDiffBaseOverride,
    useMockData,
    watchedRepos,
  } = useAppContext();

  const [rightTab, setRightTab] = useState<"comments" | "claude">("comments");

  const activeRepo = watchedRepos.find((r) => r.meta.path === activeRepoPath);

  const isLive = !useMockData && !!activeRepoPath && !!selectedBranch;

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useQuery({
    ...gitDiffQuery(
      activeRepoPath!,
      selectedBranch!,
      diffBaseOverride ?? undefined,
    ),
    enabled: isLive,
  });

  const { data: liveComments } = useQuery({
    ...commentsQuery(activeRepoPath!, selectedBranch!),
    enabled: isLive,
  });

  const { data: liveStacks = [] } = useQuery({
    ...stacksQuery(activeRepoPath!),
    enabled: isLive && (activeRepo?.meta.has_graphite ?? false),
  });
  const stacks = useMockData ? mockStacks : liveStacks;

  const activeDiff = useMockData ? mockGitDiff : diff;
  const activeComments = useMockData ? mockComments : (liveComments ?? []);

  const saveMutation = useSaveComment(
    activeRepoPath ?? "",
    selectedBranch ?? "",
  );

  // Find current stack navigation info
  const stackNav = useMemo(() => {
    if (!selectedBranch) return undefined;
    for (const stack of stacks) {
      const idx = stack.entries.findIndex(
        (e) => e.branch_name === selectedBranch,
      );
      if (idx !== -1) {
        return {
          entries: stack.entries,
          currentIndex: idx,
          parentBranch:
            diffBaseOverride ?? stack.entries[idx].meta.parent_branch,
        };
      }
    }
    return undefined;
  }, [stacks, selectedBranch, diffBaseOverride]);

  function handleAddComment(
    filePath: string,
    line: number,
    side: string,
    body: string,
    severity: Comment["severity"],
  ) {
    if (!activeRepoPath || !selectedBranch) return;
    const comment: Comment = {
      id: crypto.randomUUID(),
      revision: selectedBranch,
      file_path: filePath,
      side,
      line,
      body,
      severity,
      created_at: new Date().toISOString(),
      resolved: false,
    };
    saveMutation.mutate(comment);
  }

  function handleNavigateStack(branchName: string, parentBranch: string) {
    setSelectedBranch(branchName);
    setDiffBaseOverride(parentBranch);
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {!activeRepoPath ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Select a repository to get started
          </div>
        ) : !selectedBranch ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Select a branch from the sidebar
          </div>
        ) : diffLoading && !useMockData ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-muted">Loading diff...</span>
          </div>
        ) : diffError && !useMockData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-md max-w-md text-center">
              <p className="text-sm font-medium text-danger mb-1">
                Failed to load diff
              </p>
              <p className="text-xs text-text-muted">{String(diffError)}</p>
            </div>
          </div>
        ) : (
          <DiffViewer
            patch={activeDiff?.patch ?? ""}
            comments={activeComments}
            stackNav={stackNav}
            onNavigateStack={handleNavigateStack}
            onAddComment={handleAddComment}
          />
        )}
      </main>
      <aside className="w-80 h-full bg-surface border-l border-border flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setRightTab("comments")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              rightTab === "comments"
                ? "text-accent border-b-2 border-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setRightTab("claude")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              rightTab === "claude"
                ? "text-accent border-b-2 border-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            Claude
          </button>
        </div>

        {/* Tab content */}
        {rightTab === "comments" ? (
          <CommentsPanel comments={useMockData ? mockComments : undefined} />
        ) : (
          <ClaudePanel comments={activeComments} />
        )}
      </aside>
    </>
  );
}
