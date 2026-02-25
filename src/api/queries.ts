import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "./tauri";
import type { Comment } from "./types";

// ── Git queries ──

export function reposQuery() {
  return queryOptions({
    queryKey: ["repos"],
    queryFn: () => api.listRepos(),
  });
}

export function branchesQuery(repoPath: string) {
  return queryOptions({
    queryKey: ["branches", repoPath],
    queryFn: () => api.gitListBranches(repoPath),
    enabled: !!repoPath,
  });
}

export function gitLogQuery(
  repoPath: string,
  branch: string,
  baseOverride?: string,
) {
  return queryOptions({
    queryKey: ["git-log", repoPath, branch, baseOverride],
    queryFn: () => api.gitGetLog(repoPath, branch, baseOverride),
    enabled: !!repoPath && !!branch,
  });
}

export function gitDiffQuery(
  repoPath: string,
  branch: string,
  baseOverride?: string,
) {
  return queryOptions({
    queryKey: ["git-diff", repoPath, branch, baseOverride],
    queryFn: () => api.gitGetDiff(repoPath, branch, baseOverride),
    enabled: !!repoPath && !!branch,
  });
}

export function stacksQuery(repoPath: string) {
  return queryOptions({
    queryKey: ["stacks", repoPath],
    queryFn: () => api.getStacks(repoPath),
    enabled: !!repoPath,
  });
}

export function stackDiffQuery(repoPath: string, branch: string) {
  return queryOptions({
    queryKey: ["stack-diff", repoPath, branch],
    queryFn: () => api.getStackDiff(repoPath, branch),
    enabled: !!repoPath && !!branch,
  });
}

export function branchStatusQuery(repoPath: string, branch: string) {
  return queryOptions({
    queryKey: ["branch-status", repoPath, branch],
    queryFn: () => api.getBranchStatus(repoPath, branch),
    enabled: !!repoPath && !!branch,
  });
}

export function useMarkReviewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repoPath, branch }: { repoPath: string; branch: string }) =>
      api.markReviewed(repoPath, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
      queryClient.invalidateQueries({ queryKey: ["branch-status"] });
    },
  });
}

export function useAddRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.addRepo(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export function useRemoveRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.removeRepo(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

// ── Legacy jj queries ──

export function bookmarksQuery(repoPath: string) {
  return queryOptions({
    queryKey: ["bookmarks", repoPath],
    queryFn: () => api.listBookmarks(repoPath),
    enabled: !!repoPath,
  });
}

export function workspacesQuery(repoPath: string) {
  return queryOptions({
    queryKey: ["workspaces", repoPath],
    queryFn: () => api.listWorkspaces(repoPath),
    enabled: !!repoPath,
  });
}

export function logQuery(repoPath: string) {
  return queryOptions({
    queryKey: ["log", repoPath],
    queryFn: () => api.getLog(repoPath),
    enabled: !!repoPath,
  });
}

export function diffQuery(repoPath: string, revision: string) {
  return queryOptions({
    queryKey: ["diff", repoPath, revision],
    queryFn: () => api.getDiff(repoPath, revision),
    enabled: !!repoPath && !!revision,
  });
}

export function conflictsQuery(repoPath: string, revision: string) {
  return queryOptions({
    queryKey: ["conflicts", repoPath, revision],
    queryFn: () => api.getConflicts(repoPath, revision),
    enabled: !!repoPath && !!revision,
  });
}

// ── Comment queries ──

export function commentsQuery(repoPath: string, revision: string) {
  return queryOptions({
    queryKey: ["comments", repoPath, revision],
    queryFn: () => api.getComments(repoPath, revision),
    enabled: !!repoPath && !!revision,
  });
}

export function useSaveComment(repoPath: string, revision: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (comment: Comment) => api.saveComment(repoPath, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", repoPath, revision],
      });
    },
  });
}

export function useDeleteComment(repoPath: string, revision: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(repoPath, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", repoPath, revision],
      });
    },
  });
}

export function useResolveComment(repoPath: string, revision: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.resolveComment(repoPath, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["comments", repoPath, revision],
      });
    },
  });
}
