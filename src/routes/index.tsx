import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "../components/Sidebar";
import { DiffViewer } from "../components/DiffViewer";
import { CommentsPanel } from "../components/CommentsPanel";
import { useAppContext } from "./__root";
import { useQuery } from "@tanstack/react-query";
import { gitDiffQuery, commentsQuery, useSaveComment } from "../api/queries";
import { mockGitDiff, mockComments } from "../data/mockData";
import type { Comment } from "../api/types";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const { activeRepoPath, selectedBranch, diffBaseOverride, useMockData } =
    useAppContext();

  const isLive = !useMockData && !!activeRepoPath && !!selectedBranch;

  const { data: diff } = useQuery({
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

  const activeDiff = useMockData ? mockGitDiff : diff;
  const activeComments = useMockData ? mockComments : (liveComments ?? []);

  const saveMutation = useSaveComment(
    activeRepoPath ?? "",
    selectedBranch ?? "",
  );

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
        ) : (
          <DiffViewer
            patch={activeDiff?.patch ?? ""}
            comments={activeComments}
            onAddComment={handleAddComment}
          />
        )}
      </main>
      <CommentsPanel comments={useMockData ? mockComments : undefined} />
    </>
  );
}
