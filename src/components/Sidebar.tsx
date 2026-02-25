import { open } from "@tauri-apps/plugin-dialog";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "../routes/__root";
import { branchesQuery, reposQuery, useAddRepo } from "../api/queries";
import { mockBranches, mockGitLog } from "../data/mockData";

export function Sidebar() {
  const {
    activeRepoPath,
    setActiveRepo,
    selectedBranch,
    setSelectedBranch,
    useMockData,
    setUseMockData,
    watchedRepos,
  } = useAppContext();

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

  const addRepoMutation = useAddRepo();

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

  function handleSelectBranch(name: string) {
    setSelectedBranch(name);
  }

  function handleSelectRepo(path: string) {
    setActiveRepo(path);
    setSelectedBranch(null);
  }

  // Mock log for recent commits section
  const recentCommits = useMockData ? mockGitLog : [];

  return (
    <aside className="w-72 h-full bg-surface border-r border-border flex flex-col overflow-hidden">
      {/* Repo Switcher */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={activeRepoPath ?? ""}
            onChange={(e) => handleSelectRepo(e.target.value)}
            className="flex-1 bg-bg border border-border rounded-md text-sm text-text px-2 py-1.5 focus:outline-none focus:border-accent truncate"
          >
            <option value="" disabled>
              Select a repo...
            </option>
            {repos.map((r) => (
              <option key={r.meta.path} value={r.meta.path}>
                {r.has_any_attention ? "\u25CF " : ""}
                {r.meta.display_name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddRepo}
            className="px-2 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors shrink-0"
            title="Add repository"
          >
            +
          </button>
        </div>
        {activeRepo && (
          <p
            className="text-xs text-text-muted truncate"
            title={activeRepo.meta.path}
          >
            {activeRepo.meta.path}
            {activeRepo.meta.has_graphite && (
              <span className="ml-1 text-accent">(Graphite)</span>
            )}
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
                        <span className="text-xs text-text-muted">(base)</span>
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

            {/* Recent Commits (for selected branch) */}
            {selectedBranch && recentCommits.length > 0 && (
              <div className="p-3 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Recent Commits
                </h3>
                {recentCommits.map((entry) => (
                  <div
                    key={entry.commit_id}
                    className="px-3 py-2 text-sm mb-0.5"
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
          </>
        )}
      </div>
    </aside>
  );
}
