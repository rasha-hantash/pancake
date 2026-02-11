<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';
  import DiffViewer from '$lib/components/DiffViewer.svelte';
  import ConflictViewer from '$lib/components/ConflictViewer.svelte';
  import CommentsPanel from '$lib/components/CommentsPanel.svelte';
  import { getState, selectRepo } from '$lib/stores/repo.svelte.js';

  const appState = getState();

  let activeTab = $state<'diff' | 'conflicts'>('diff');
  let commentFilePath = $state('');
  let commentSide = $state('new');
  let commentLine = $state(0);

  function handleLineClick(filePath: string, side: string, line: number) {
    commentFilePath = filePath;
    commentSide = side;
    commentLine = line;
  }

  // Auto-load current directory as repo on startup
  $effect(() => {
    // Try to auto-detect repo path (the app's own directory or CWD)
    // Users can always change it via the sidebar
  });
</script>

<div class="flex h-screen bg-bg text-text overflow-hidden">
  <!-- Left Sidebar: Bookmarks, Workspaces, Log -->
  <Sidebar />

  <!-- Main Content Area -->
  <main class="flex-1 flex flex-col min-w-0">
    <!-- Top bar -->
    <header class="h-12 border-b border-border bg-surface flex items-center px-4 justify-between shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="text-sm font-semibold text-text">
          {#if appState.selectedRevision}
            <span class="font-mono text-accent">{appState.selectedRevision.slice(0, 8)}</span>
            {#if appState.currentDiff?.description}
              <span class="text-text-muted ml-2">—</span>
              <span class="ml-2 text-text">{appState.currentDiff.description}</span>
            {/if}
          {:else}
            <span class="text-text-muted">Select a revision to view diffs</span>
          {/if}
        </h1>
      </div>

      {#if appState.selectedRevision}
        <div class="flex items-center gap-1">
          <button
            onclick={() => (activeTab = 'diff')}
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              {activeTab === 'diff'
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:text-text hover:bg-surface-hover'}"
          >
            Diff
            {#if appState.currentDiff?.files_changed.length}
              <span class="ml-1 text-xs opacity-60">({appState.currentDiff.files_changed.length})</span>
            {/if}
          </button>
          <button
            onclick={() => (activeTab = 'conflicts')}
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              {activeTab === 'conflicts'
                ? 'bg-danger/20 text-danger'
                : 'text-text-muted hover:text-text hover:bg-surface-hover'}
              {appState.conflicts.length > 0 ? '' : 'opacity-40'}"
            disabled={appState.conflicts.length === 0}
          >
            Conflicts
            {#if appState.conflicts.length > 0}
              <span class="ml-1 text-xs">({appState.conflicts.length})</span>
            {/if}
          </button>
        </div>
      {/if}
    </header>

    <!-- Content -->
    <div class="flex-1 min-h-0 overflow-auto">
      {#if appState.loading}
        <div class="flex items-center justify-center h-full">
          <div class="text-text-muted text-sm animate-pulse">Loading...</div>
        </div>
      {:else if !appState.selectedRevision}
        <div class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="text-6xl mb-4">🥞</div>
            <h2 class="text-xl font-semibold text-text mb-2">Pancake</h2>
            <p class="text-text-muted text-sm max-w-md">
              Review diffs across your jj branches and workspaces.
              Add inline comments and export them for AI agents.
            </p>
            <p class="text-text-muted text-xs mt-4">
              Select a repository and revision from the sidebar to get started.
            </p>
          </div>
        </div>
      {:else if activeTab === 'diff'}
        <DiffViewer
          patch={appState.currentDiff?.patch || ''}
          comments={appState.comments}
          onLineClick={handleLineClick}
        />
      {:else if activeTab === 'conflicts'}
        <ConflictViewer
          conflicts={appState.conflicts}
          onLineClick={handleLineClick}
        />
      {/if}
    </div>
  </main>

  <!-- Right Panel: Comments -->
  <CommentsPanel
    activeFilePath={commentFilePath}
    activeSide={commentSide}
    activeLine={commentLine}
  />
</div>
