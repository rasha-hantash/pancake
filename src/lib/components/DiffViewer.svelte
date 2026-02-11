<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { FileDiff, parsePatchFiles } from '@pierre/diffs';
  import type { Comment } from '$lib/api/types.js';

  let {
    patch = '',
    comments = [] as Comment[],
    onLineClick,
  }: {
    patch: string;
    comments?: Comment[];
    onLineClick?: (filePath: string, side: string, line: number) => void;
  } = $props();

  let container: HTMLDivElement;
  let fileDiffs: FileDiff[] = [];

  function buildAnnotations(cmts: Comment[], filePath: string) {
    return cmts
      .filter((c) => c.file_path === filePath)
      .map((c) => ({
        side: c.side as 'old' | 'new',
        line: c.line,
        widget: {
          html: `<div style="padding: 8px 12px; margin: 4px 0; border-radius: 6px; font-size: 13px; font-family: system-ui;
            background: ${c.resolved ? '#1a2e1a' : c.severity === 'issue' ? '#2e1a1a' : '#1a1a2e'};
            border-left: 3px solid ${c.resolved ? '#22c55e' : c.severity === 'issue' ? '#ef4444' : c.severity === 'question' ? '#f59e0b' : '#6366f1'};">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: ${c.resolved ? '#22c55e' : c.severity === 'issue' ? '#ef4444' : c.severity === 'question' ? '#f59e0b' : '#6366f1'};">${c.severity}${c.resolved ? ' ✓' : ''}</span>
            </div>
            <div style="color: #e4e4ef;">${c.body}</div>
          </div>`,
        },
      }));
  }

  function cleanup() {
    for (const fd of fileDiffs) {
      fd.destroy?.();
    }
    fileDiffs = [];
    if (container) {
      container.innerHTML = '';
    }
  }

  function renderDiff() {
    if (!container) return;
    cleanup();

    if (!patch?.trim()) {
      container.innerHTML = '<div style="padding: 2rem; color: #8888a0; text-align: center;">No changes in this revision</div>';
      return;
    }

    try {
      const parsed = parsePatchFiles(patch);

      if (!parsed || parsed.length === 0) {
        // Fallback: render raw patch
        container.innerHTML = `<pre style="padding: 1rem; color: #e4e4ef; white-space: pre-wrap; font-family: monospace; font-size: 13px;">${patch.replace(/</g, '&lt;')}</pre>`;
        return;
      }

      for (const fileMeta of parsed) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '2px';
        container.appendChild(wrapper);

        // Determine file path for annotations
        const filePath = fileMeta.newFile?.fileName || fileMeta.oldFile?.fileName || 'unknown';
        const annotations = buildAnnotations(comments, filePath);

        const fd = new FileDiff(wrapper, {
          file: fileMeta,
          theme: 'github-dark',
          annotations,
        });

        fileDiffs.push(fd);
      }
    } catch (e) {
      console.error('Failed to render diff:', e);
      container.innerHTML = `<pre style="padding: 1rem; color: #e4e4ef; white-space: pre-wrap; font-family: monospace; font-size: 13px;">${patch.replace(/</g, '&lt;')}</pre>`;
    }
  }

  // Handle click events on the diff for adding comments
  function handleContainerClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Walk up to find line-number or clickable element
    let el: HTMLElement | null = target;
    while (el && el !== container) {
      const lineNum = el.getAttribute('data-line-number') || el.getAttribute('data-line');
      if (lineNum) {
        const line = parseInt(lineNum, 10);
        if (line > 0) {
          const side = el.closest('[data-side="old"]') ? 'old' : 'new';
          // Try to find file path
          let fileEl: HTMLElement | null = el;
          let filePath = 'unknown';
          while (fileEl && fileEl !== container) {
            const fp = fileEl.getAttribute('data-file-path') || fileEl.getAttribute('data-filename');
            if (fp) {
              filePath = fp;
              break;
            }
            fileEl = fileEl.parentElement;
          }
          onLineClick?.(filePath, side, line);
          return;
        }
      }
      el = el.parentElement;
    }
  }

  onMount(() => {
    renderDiff();
    return () => cleanup();
  });

  $effect(() => {
    // Track deps
    void patch;
    void comments;
    renderDiff();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex-1 overflow-auto bg-bg" onclick={handleContainerClick}>
  <div bind:this={container} class="min-h-full"></div>
</div>
