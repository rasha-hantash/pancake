import { open } from "@tauri-apps/plugin-dialog";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "../routes/__root";
import { setRepoPath } from "../api/tauri";
import { bookmarksQuery, workspacesQuery, logQuery } from "../api/queries";
import { mockLogEntries } from "../data/mockData";

export function Sidebar() {
  const {
    repoPath,
    setRepoPath: setAppRepoPath,
    selectedRevision,
    setSelectedRevision,
    useMockData,
    setUseMockData,
  } = useAppContext();

  const isLive = !useMockData && !!repoPath;
  const { data: workspaces = [] } = useQuery({
    ...workspacesQuery(repoPath!),
    enabled: isLive,
  });
  const { data: bookmarks = [] } = useQuery({
    ...bookmarksQuery(repoPath!),
    enabled: isLive,
  });
  const { data: liveLogEntries = [] } = useQuery({
    ...logQuery(repoPath!),
    enabled: isLive,
  });

  const logEntries = useMockData ? mockLogEntries : liveLogEntries;

  async function openRepoDialog() {
    if (useMockData) {
      setUseMockData(false);
      setAppRepoPath(null);
      setSelectedRevision(null);
    }
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select JJ Repository",
    });
    if (selected) {
      const canonical = await setRepoPath(selected as string);
      setAppRepoPath(canonical);
      setSelectedRevision(null);
    }
  }

  function handleSelect(rev: string) {
    setSelectedRevision(rev);
  }

  return (
    <aside className="w-72 h-full bg-surface border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <button
          onClick={openRepoDialog}
          className="w-full px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          {repoPath ? "Change Repo" : "Select Repository"}
        </button>
        {repoPath && (
          <p className="mt-2 text-xs text-text-muted truncate" title={repoPath}>
            {repoPath}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {repoPath && (
          <>
            {/* Workspaces */}
            {workspaces.length > 0 && (
              <div className="p-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Workspaces
                </h3>
                {workspaces.map((ws) => (
                  <button
                    key={ws.change_id}
                    onClick={() => handleSelect(ws.change_id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 ${
                      selectedRevision === ws.change_id
                        ? "bg-accent/20 text-accent-hover"
                        : "text-text hover:bg-surface-hover"
                    }`}
                  >
                    <span className="font-mono text-xs">{ws.name}</span>
                    <span className="block text-xs text-text-muted font-mono">
                      {ws.change_id.slice(0, 8)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Bookmarks */}
            {bookmarks.length > 0 && (
              <div className="p-3 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Bookmarks
                </h3>
                {bookmarks.map((bm) => (
                  <button
                    key={bm.change_id}
                    onClick={() => handleSelect(bm.change_id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 ${
                      selectedRevision === bm.change_id
                        ? "bg-accent/20 text-accent-hover"
                        : "text-text hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-success shrink-0" />
                      <span className="font-medium truncate">{bm.name}</span>
                    </div>
                    {bm.description && (
                      <p className="text-xs text-text-muted mt-0.5 truncate pl-4">
                        {bm.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Log */}
            {logEntries.length > 0 && (
              <div className="p-3 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Recent Changes
                </h3>
                {logEntries.map((entry) => (
                  <button
                    key={entry.change_id}
                    onClick={() => handleSelect(entry.change_id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 ${
                      selectedRevision === entry.change_id
                        ? "bg-accent/20 text-accent-hover"
                        : "text-text hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {entry.is_working_copy && (
                        <span className="text-accent font-bold">@</span>
                      )}
                      {entry.has_conflict && (
                        <span className="text-danger text-xs">&#x26A0;</span>
                      )}
                      <span className="font-mono text-xs text-text-muted">
                        {entry.change_id.slice(0, 8)}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        entry.description
                          ? "text-text"
                          : "text-text-muted italic"
                      }`}
                    >
                      {entry.description || "(no description)"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">
                        {entry.timestamp}
                      </span>
                      {entry.bookmarks.map((bm) => (
                        <span
                          key={bm}
                          className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded"
                        >
                          {bm}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
