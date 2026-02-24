import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { mockLogEntries } from "../data/mockData";

interface AppContextValue {
  repoPath: string | null;
  setRepoPath: (path: string | null) => void;
  selectedRevision: string | null;
  setSelectedRevision: (rev: string | null) => void;
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
  const [repoPath, setRepoPath] = useState<string | null>(
    useMockData ? "(mock)" : null,
  );
  const [selectedRevision, setSelectedRevision] = useState<string | null>(
    useMockData ? mockLogEntries[0].change_id : null,
  );

  return (
    <AppContext.Provider
      value={{
        repoPath,
        setRepoPath,
        selectedRevision,
        setSelectedRevision,
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
