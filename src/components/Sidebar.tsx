import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "../routes/__root";
import {
  branchesQuery,
  gitLogQuery,
  reposQuery,
  useAddRepo,
  useRemoveRepo,
  useMarkReviewed,
} from "../api/queries";
import { mockBranches, mockGitLog } from "../data/mockData";

export function Sidebar() {
  const {
    activeRepoPath,
    setActiveRepo,
    selectedBranch,
    setSelectedBranch,
    diffBaseOverride,
    useMockData,
    setUseMockData,
    watchedRepos,
  } = useAppContext();

  const [showRepoMenu, setShowRepoMenu] = useState(false);
  const [showCommits, setShowCommits] = useState(true);

  const { data: liveRepos = [] } = useQuery({
    ...reposQuery(),
    enabled: !useMockData,
  });
  const repos = useMockData ? watchedRepos : liveRepos;

  const isLive = !useMockData && !!activeRepoPath;
  const { data: liveBranches = [] } = useQuery({
    ...branchesQuery(activeRepoPath!),
    enabled: isLive,
  });
  const branches = useMockData ? mockBranches : liveBranches;

  const { data: liveLog = [] } = useQuery({
    ...gitLogQuery(
      activeRepoPath!,
      selectedBranch!,
      diffBaseOverride ?? undefined,
    ),
    enabled: isLive && !!selectedBranch,
  });
  const recentCommits = useMockData ? mockGitLog : liveLog;

  const addRepoMutation = useAddRepo();
  const removeRepoMutation = useRemoveRepo();
  const markReviewedMutation = useMarkReviewed();

  const activeRepo = repos.find((r) => r.meta.path === activeRepoPath);

  async function handleAddRepo() {
    if (useMockData) {
      setUseMockData(false);
      setActiveRepo(null);
      setSelectedBranch(null);
    }
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Git Repository",
    });
    if (selected) {
      const meta = await addRepoMutation.mutateAsync(selected as string);
      setActiveRepo(meta.path);
      setSelectedBranch(null);
    }
  }

  function handleRemoveRepo(path: string) {
    removeRepoMutation.mutate(path);
    if (activeRepoPath === path) {
      setActiveRepo(null);
      setSelectedBranch(null);
    }
    setShowRepoMenu(false);
  }

  function handleSelectBranch(name: string) {
    setSelectedBranch(name);
    // Mark as reviewed when selecting
    if (!useMockData && activeRepoPath) {
      markReviewedMutation.mutate({
        repoPath: activeRepoPath,
        branch: name,
      });
    }
  }

  function handleSelectRepo(path: string) {
    setActiveRepo(path);
    setSelectedBranch(null);
    setShowRepoMenu(false);
  }

  return (
    <aside className="w-72 h-full bg-surface border-r border-border flex flex-col overflow-hidden">
      {/* Repo Switcher */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <button
            onClick={() => setShowRepoMenu(!showRepoMenu)}
            className="w-full flex items-center justify-between px-3 py-2 bg-bg border border-border rounded-md text-sm text-text hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {activeRepo?.has_any_attention && (
                <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
              )}
              <span className="truncate">
                {activeRepo?.meta.display_name ?? "Select a repo..."}
              </span>
            </div>
            <span className="text-text-muted ml-2 shrink-0">&#x25BE;</span>
          </button>

          {/* Repo Dropdown */}
          {showRepoMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
              {repos.map((r) => (
                <div
                  key={r.meta.path}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-surface-hover cursor-pointer ${
                    r.meta.path === activeRepoPath ? "bg-accent/10" : ""
                  }`}
                >
                  <button
                    onClick={() => handleSelectRepo(r.meta.path)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    {r.has_any_attention && (
                      <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                    )}
                    <span className="text-sm text-text truncate">
                      {r.meta.display_name}
                    </span>
                    {r.meta.has_graphite && (
                      <span className="text-xs text-accent shrink-0">GT</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRepo(r.meta.path);
                    }}
                    className="p-1 hover:bg-danger/20 rounded text-text-muted hover:text-danger transition-colors shrink-0 ml-2"
                    title="Remove repo"
                  >
                    <span className="text-xs">&#x2715;</span>
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setShowRepoMenu(false);
                  handleAddRepo();
                }}
                className="w-full px-3 py-2 text-sm text-accent hover:bg-surface-hover text-left border-t border-border"
              >
                + Add Repository
              </button>
            </div>
          )}
        </div>

        {activeRepo && (
          <p
            className="mt-2 text-xs text-text-muted truncate"
            title={activeRepo.meta.path}
          >
            {activeRepo.meta.path}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activeRepoPath && (
          <>
            {/* Branches */}
            <div className="p-3">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Branches
              </h3>
              {branches.map((branch) => {
                const needsAttention =
                  activeRepo?.branch_statuses[branch.name] ?? false;
                const isBase = activeRepo?.meta.base_branch === branch.name;

                return (
                  <button
                    key={branch.name}
                    onClick={() => handleSelectBranch(branch.name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 ${
                      selectedBranch === branch.name
                        ? "bg-accent/20 text-accent-hover"
                        : "text-text hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {needsAttention && (
                        <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                      )}
                      {branch.is_current && (
                        <span className="text-accent font-bold text-xs">*</span>
                      )}
                      <span className="font-medium truncate">
                        {branch.name}
                      </span>
                      {isBase && (
                        <span className="text-xs text-text-muted ml-auto shrink-0">
                          (base)
                        </span>
                      )}
                    </div>
                    {!isBase &&
                      (branch.ahead_count > 0 || branch.behind_count > 0) && (
                        <div className="flex items-center gap-2 mt-0.5 pl-4 text-xs text-text-muted">
                          {branch.ahead_count > 0 && (
                            <span className="text-success">
                              +{branch.ahead_count}
                            </span>
                          )}
                          {branch.behind_count > 0 && (
                            <span className="text-danger">
                              -{branch.behind_count}
                            </span>
                          )}
                        </div>
                      )}
                  </button>
                );
              })}
            </div>

            {/* Recent Commits (collapsible) */}
            {selectedBranch && recentCommits.length > 0 && (
              <div className="border-t border-border">
                <button
                  onClick={() => setShowCommits(!showCommits)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider hover:bg-surface-hover"
                >
                  <span>Recent Commits ({recentCommits.length})</span>
                  <span>{showCommits ? "&#x25B4;" : "&#x25BE;"}</span>
                </button>
                {showCommits && (
                  <div className="px-3 pb-3">
                    {recentCommits.map((entry) => (
                      <div
                        key={entry.commit_id}
                        className="px-3 py-2 text-sm mb-0.5 rounded-md"
                      >
                        <p className="text-xs text-text truncate">
                          {entry.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-text-muted font-mono">
                            {entry.commit_id.slice(0, 7)}
                          </span>
                          <span className="text-xs text-text-muted">
                            {entry.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
