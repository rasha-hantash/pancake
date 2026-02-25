import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import type { RepoWithStatus } from "../api/types";
import { mockRepos, mockBranches } from "../data/mockData";

interface AppContextValue {
  // Multi-repo state
  watchedRepos: RepoWithStatus[];
  activeRepoPath: string | null;
  setActiveRepo: (path: string | null) => void;

  // Branch state
  selectedBranch: string | null;
  setSelectedBranch: (branch: string | null) => void;

  // Diff base override (for stack parent diffing)
  diffBaseOverride: string | null;
  setDiffBaseOverride: (base: string | null) => void;

  // Mock data toggle
  useMockData: boolean;
  setUseMockData: (mock: boolean) => void;
}

const AppContext = createContext<AppContextValue>(null!);

export function useAppContext() {
  return useContext(AppContext);
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootComponent,
  },
);

function RootComponent() {
  const [useMockData, setUseMockData] = useState(true);
  const [activeRepoPath, setActiveRepoPath] = useState<string | null>(
    useMockData ? mockRepos[0].meta.path : null,
  );
  const [selectedBranch, setSelectedBranch] = useState<string | null>(
    useMockData ? mockBranches[1].name : null,
  );
  const [diffBaseOverride, setDiffBaseOverride] = useState<string | null>(null);

  const watchedRepos = useMockData ? mockRepos : [];

  return (
    <AppContext.Provider
      value={{
        watchedRepos,
        activeRepoPath,
        setActiveRepo: setActiveRepoPath,
        selectedBranch,
        setSelectedBranch,
        diffBaseOverride,
        setDiffBaseOverride,
        useMockData,
        setUseMockData,
      }}
    >
      <div className="flex h-screen bg-bg text-text">
        <Outlet />
      </div>
    </AppContext.Provider>
  );
}
