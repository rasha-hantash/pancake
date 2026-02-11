<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { getState, selectRepo, selectRevision } from '$lib/stores/repo.svelte.js';

  let { onSelectRevision }: { onSelectRevision?: (rev: string) => void } = $props();
  const appState = getState();

  async function openRepoDialog() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select JJ Repository',
    });
    if (selected) {
      await selectRepo(selected as string);
    }
  }

  function handleSelect(rev: string) {
    selectRevision(rev);
    onSelectRevision?.(rev);
  }
</script>

<aside class="w-72 h-full bg-surface border-r border-border flex flex-col overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-border">
    <button
      onclick={openRepoDialog}
      class="w-full px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
    >
      {appState.repoPath ? 'Change Repo' : 'Select Repository'}
    </button>
    {#if appState.repoPath}
      <p class="mt-2 text-xs text-text-muted truncate" title={appState.repoPath}>
        {appState.repoPath}
      </p>
    {/if}
  </div>

  <!-- Scrollable content -->
  <div class="flex-1 overflow-y-auto">
    {#if appState.loading && !appState.repoPath}
      <div class="p-4 text-text-muted text-sm">Loading...</div>
    {/if}

    {#if appState.repoPath}
      <!-- Workspaces -->
      {#if appState.workspaces.length > 0}
        <div class="p-3">
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Workspaces
          </h3>
          {#each appState.workspaces as ws}
            <button
              onclick={() => handleSelect(ws.change_id)}
              class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5
                {appState.selectedRevision === ws.change_id
                  ? 'bg-accent/20 text-accent-hover'
                  : 'text-text hover:bg-surface-hover'}"
            >
              <span class="font-mono text-xs">{ws.name}</span>
              <span class="block text-xs text-text-muted font-mono">{ws.change_id.slice(0, 8)}</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Bookmarks -->
      {#if appState.bookmarks.length > 0}
        <div class="p-3 border-t border-border">
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Bookmarks
          </h3>
          {#each appState.bookmarks as bm}
            <button
              onclick={() => handleSelect(bm.change_id)}
              class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5
                {appState.selectedRevision === bm.change_id
                  ? 'bg-accent/20 text-accent-hover'
                  : 'text-text hover:bg-surface-hover'}"
            >
              <div class="flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full bg-success shrink-0"></span>
                <span class="font-medium truncate">{bm.name}</span>
              </div>
              {#if bm.description}
                <p class="text-xs text-text-muted mt-0.5 truncate pl-4">{bm.description}</p>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Log -->
      {#if appState.logEntries.length > 0}
        <div class="p-3 border-t border-border">
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Recent Changes
          </h3>
          {#each appState.logEntries as entry}
            <button
              onclick={() => handleSelect(entry.change_id)}
              class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5
                {appState.selectedRevision === entry.change_id
                  ? 'bg-accent/20 text-accent-hover'
                  : 'text-text hover:bg-surface-hover'}"
            >
              <div class="flex items-center gap-2">
                {#if entry.is_working_copy}
                  <span class="text-accent font-bold">@</span>
                {/if}
                {#if entry.has_conflict}
                  <span class="text-danger text-xs">⚠</span>
                {/if}
                <span class="font-mono text-xs text-text-muted">{entry.change_id.slice(0, 8)}</span>
              </div>
              <p class="text-xs truncate mt-0.5 {entry.description ? 'text-text' : 'text-text-muted italic'}">
                {entry.description || '(no description)'}
              </p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-text-muted">{entry.timestamp}</span>
                {#each entry.bookmarks as bm}
                  <span class="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">{bm}</span>
                {/each}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Error display -->
  {#if appState.error}
    <div class="p-3 border-t border-danger/30 bg-danger/10">
      <p class="text-xs text-danger">{appState.error}</p>
    </div>
  {/if}
</aside>
