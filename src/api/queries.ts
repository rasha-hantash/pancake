import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "./tauri";
import type { Comment } from "./types";

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
