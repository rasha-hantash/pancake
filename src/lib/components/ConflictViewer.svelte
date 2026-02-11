<script lang="ts">
  import type { ConflictFile } from '$lib/api/types.js';

  let {
    conflicts = [] as ConflictFile[],
    onLineClick,
  }: {
    conflicts?: ConflictFile[];
    onLineClick?: (filePath: string, side: string, line: number) => void;
  } = $props();

  let selectedFile = $state<string | null>(null);

  let selectedConflict = $derived(
    conflicts.find((c) => c.path === selectedFile) || conflicts[0] || null,
  );

  function isMarkerLine(lineNum: number, conflict: ConflictFile): boolean {
    return conflict.marker_lines.includes(lineNum);
  }

  type MarkerType = 'start' | 'separator' | 'end' | 'diff-start' | 'diff-del' | 'diff-add' | null;
  
  function getMarkerType(line: string): MarkerType {
    if (line.startsWith('<<<<<<<')) return 'start';
    if (line.startsWith('>>>>>>>')) return 'end';
    if (line.startsWith('=======')) return 'separator';
    if (line.startsWith('|||||||')) return 'separator';
    if (line.startsWith('%%%%%%%')) return 'diff-start';
    if (line.startsWith('-------')) return 'diff-del';
    if (line.startsWith('+++++++')) return 'diff-add';
    return null;
  }

  function markerColor(type: MarkerType): string {
    switch (type) {
      case 'start': return 'bg-danger/20 text-danger border-l-2 border-danger';
      case 'end': return 'bg-danger/20 text-danger border-l-2 border-danger';
      case 'separator': return 'bg-warning/20 text-warning border-l-2 border-warning';
      case 'diff-start': return 'bg-accent/20 text-accent border-l-2 border-accent';
      case 'diff-del': return 'bg-danger/10 text-danger/80 border-l-2 border-danger/50';
      case 'diff-add': return 'bg-success/10 text-success/80 border-l-2 border-success/50';
      default: return '';
    }
  }
</script>

{#if conflicts.length === 0}
  <div class="flex items-center justify-center h-full text-text-muted text-sm">
    No conflicts in this revision
  </div>
{:else}
  <div class="flex flex-col h-full">
    <!-- File tabs -->
    <div class="flex gap-1 px-4 pt-3 pb-2 border-b border-border bg-surface overflow-x-auto">
      {#each conflicts as conflict}
        <button
          onclick={() => (selectedFile = conflict.path)}
          class="px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap
            {selectedFile === conflict.path || (selectedFile === null && conflict === conflicts[0])
              ? 'bg-danger/20 text-danger'
              : 'text-text-muted hover:bg-surface-hover hover:text-text'}"
        >
          <span class="mr-1">⚠</span>
          {conflict.path}
        </button>
      {/each}
    </div>

    <!-- File content with conflict markers -->
    {#if selectedConflict}
      <div class="flex-1 overflow-auto bg-bg">
        <table class="w-full text-xs font-mono">
          <tbody>
            {#each selectedConflict.content.split('\n') as line, i}
              {@const lineNum = i + 1}
              {@const markerType = getMarkerType(line)}
              <tr
                class="hover:bg-surface-hover/50 cursor-pointer {markerType ? markerColor(markerType) : ''}"
                onclick={() => onLineClick?.(selectedConflict!.path, 'conflict', lineNum)}
              >
                <td class="w-12 text-right pr-3 py-0.5 text-text-muted select-none border-r border-border/30 {isMarkerLine(lineNum, selectedConflict!) ? 'font-bold' : ''}">
                  {lineNum}
                </td>
                <td class="pl-4 pr-4 py-0.5 whitespace-pre {markerType ? 'font-bold' : 'text-text'}">
                  {line}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}
