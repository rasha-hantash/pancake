import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "../components/Sidebar";
import { DiffViewer } from "../components/DiffViewer";
import { CommentsPanel } from "../components/CommentsPanel";
import { ConflictViewer } from "../components/ConflictViewer";
import { useAppContext } from "./__root";
import { useQuery } from "@tanstack/react-query";
import { diffQuery, conflictsQuery, commentsQuery } from "../api/queries";
import { mockDiff, mockComments } from "../data/mockData";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const { repoPath, selectedRevision, useMockData } = useAppContext();

  const isLive = !useMockData && !!repoPath && !!selectedRevision;

  const { data: diff } = useQuery({
    ...diffQuery(repoPath!, selectedRevision!),
    enabled: isLive,
  });

  const { data: conflicts } = useQuery({
    ...conflictsQuery(repoPath!, selectedRevision!),
    enabled: isLive,
  });

  const { data: liveComments } = useQuery({
    ...commentsQuery(repoPath!, selectedRevision!),
    enabled: isLive,
  });

  const activeDiff = useMockData ? mockDiff : diff;
  const activeComments = useMockData ? mockComments : (liveComments ?? []);
  const hasConflicts = !useMockData && conflicts && conflicts.length > 0;

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {!repoPath ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Select a repository to get started
          </div>
        ) : !selectedRevision ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Select a revision from the sidebar
          </div>
        ) : hasConflicts ? (
          <ConflictViewer conflicts={conflicts} />
        ) : (
          <DiffViewer
            patch={activeDiff?.patch ?? ""}
            comments={activeComments}
          />
        )}
      </main>
      <CommentsPanel comments={useMockData ? mockComments : undefined} />
    </>
  );
}
