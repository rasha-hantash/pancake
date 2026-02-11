<script lang="ts">
  import { getState, addComment, removeComment, toggleResolveComment, exportForAgent } from '$lib/stores/repo.svelte.js';
  import type { Comment } from '$lib/api/types.js';

  let {
    activeFilePath = '',
    activeSide = 'new',
    activeLine = 0,
  }: {
    activeFilePath?: string;
    activeSide?: string;
    activeLine?: number;
  } = $props();

  const appState = getState();

  let newBody = $state('');
  let newSeverity = $state<'note' | 'nit' | 'issue' | 'question'>('note');
  let exportOutput = $state('');
  let showExport = $state(false);

  // Group comments by file
  let groupedComments = $derived.by(() => {
    const groups: Record<string, Comment[]> = {};
    for (const c of appState.comments) {
      if (!groups[c.file_path]) groups[c.file_path] = [];
      groups[c.file_path].push(c);
    }
    // Sort within each group by line
    for (const file in groups) {
      groups[file].sort((a, b) => a.line - b.line);
    }
    return groups;
  });

  let unresolvedCount = $derived(appState.comments.filter((c) => !c.resolved).length);

  async function handleAddComment() {
    if (!newBody.trim()) return;
    await addComment(
      activeFilePath || 'general',
      activeSide,
      activeLine,
      newBody.trim(),
      newSeverity,
    );
    newBody = '';
  }

  async function handleExport() {
    const result = await exportForAgent();
    if (result) {
      exportOutput = result.summary;
      showExport = true;
      // Also copy to clipboard
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(result, null, 2),
        );
      } catch {}
    }
  }

  function severityColor(s: string) {
    switch (s) {
      case 'issue': return 'text-danger';
      case 'question': return 'text-warning';
      case 'nit': return 'text-accent';
      default: return 'text-accent';
    }
  }

  function severityBg(s: string) {
    switch (s) {
      case 'issue': return 'bg-danger/10 border-danger/30';
      case 'question': return 'bg-warning/10 border-warning/30';
      case 'nit': return 'bg-accent/10 border-accent/30';
      default: return 'bg-accent/10 border-accent/30';
    }
  }
</script>

<aside class="w-80 h-full bg-surface border-l border-border flex flex-col overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-border flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold text-text">Comments</h2>
      <p class="text-xs text-text-muted">
        {unresolvedCount} unresolved · {appState.comments.length} total
      </p>
    </div>
    {#if appState.selectedRevision}
      <button
        onclick={handleExport}
        class="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-md transition-colors"
      >
        Export
      </button>
    {/if}
  </div>

  <!-- Add Comment Form -->
  {#if appState.selectedRevision}
    <div class="p-4 border-b border-border">
      {#if activeLine > 0}
        <div class="text-xs text-text-muted mb-2 font-mono">
          {activeFilePath}:{activeLine} ({activeSide})
        </div>
      {/if}
      <div class="flex gap-2 mb-2">
        <select
          bind:value={newSeverity}
          class="bg-bg border border-border rounded-md text-xs text-text px-2 py-1.5 focus:outline-none focus:border-accent"
        >
          <option value="note">Note</option>
          <option value="nit">Nit</option>
          <option value="issue">Issue</option>
          <option value="question">Question</option>
        </select>
      </div>
      <textarea
        bind:value={newBody}
        placeholder="Add a review comment..."
        rows="3"
        class="w-full bg-bg border border-border rounded-md text-sm text-text px-3 py-2 focus:outline-none focus:border-accent resize-none"
        onkeydown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleAddComment();
          }
        }}
      ></textarea>
      <div class="flex justify-between items-center mt-2">
        <span class="text-xs text-text-muted">⌘+Enter to submit</span>
        <button
          onclick={handleAddComment}
          disabled={!newBody.trim()}
          class="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
        >
          Add Comment
        </button>
      </div>
    </div>
  {/if}

  <!-- Comments List -->
  <div class="flex-1 overflow-y-auto">
    {#if Object.keys(groupedComments).length === 0}
      <div class="p-8 text-center text-text-muted text-sm">
        {#if appState.selectedRevision}
          No comments yet.<br />Click a line in the diff to start reviewing.
        {:else}
          Select a revision to start reviewing.
        {/if}
      </div>
    {:else}
      {#each Object.entries(groupedComments) as [filePath, fileComments]}
        <div class="border-b border-border">
          <div class="px-4 py-2 bg-bg/50">
            <span class="text-xs font-mono text-text-muted truncate block">{filePath}</span>
          </div>
          {#each fileComments as comment}
            <div
              class="px-4 py-3 border-t border-border/50 {comment.resolved ? 'opacity-50' : ''}"
            >
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs font-semibold uppercase {severityColor(comment.severity)}"
                  >
                    {comment.severity}
                  </span>
                  <span class="text-xs text-text-muted font-mono">
                    L{comment.line} ({comment.side})
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onclick={() => toggleResolveComment(comment.id)}
                    class="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-success transition-colors"
                    title={comment.resolved ? 'Unresolve' : 'Resolve'}
                  >
                    {#if comment.resolved}
                      <span class="text-success text-sm">✓</span>
                    {:else}
                      <span class="text-sm">○</span>
                    {/if}
                  </button>
                  <button
                    onclick={() => removeComment(comment.id)}
                    class="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-danger transition-colors"
                    title="Delete"
                  >
                    <span class="text-sm">✕</span>
                  </button>
                </div>
              </div>
              <p class="text-sm text-text leading-relaxed">{comment.body}</p>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Export Modal -->
  {#if showExport}
    <div class="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-surface border border-border rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-semibold text-text">Agent Export</h3>
          <button
            onclick={() => (showExport = false)}
            class="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
        <pre class="flex-1 overflow-auto bg-bg p-4 rounded-lg text-xs text-text font-mono whitespace-pre-wrap">{exportOutput}</pre>
        <p class="mt-3 text-xs text-text-muted">
          Full JSON has been copied to clipboard.
        </p>
      </div>
    </div>
  {/if}
</aside>
