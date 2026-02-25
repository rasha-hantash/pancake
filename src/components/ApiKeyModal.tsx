import { useState, useEffect } from "react";
import { getClaudeKey, setClaudeKey } from "../api/tauri";

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ open, onClose }: ApiKeyModalProps) {
  const [key, setKey] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      getClaudeKey().then((existing) => {
        setHasExisting(!!existing);
        setKey("");
        setError(null);
      });
    }
  }, [open]);

  if (!open) return null;

  async function handleSave() {
    const trimmed = key.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith("sk-ant-")) {
      setError("API key should start with sk-ant-");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setClaudeKey(trimmed);
      setHasExisting(true);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg shadow-xl w-96 max-w-[90vw]">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Claude API Key</h2>
          <p className="text-xs text-text-muted mt-1">
            Enter your Anthropic API key to enable Claude-powered code review.
          </p>
        </div>

        <div className="p-4">
          {hasExisting && (
            <p className="text-xs text-success mb-3">
              An API key is already configured. Enter a new one to replace it.
            </p>
          )}

          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            autoFocus
            className="w-full bg-bg border border-border rounded-md text-sm text-text px-3 py-2 focus:outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onClose();
            }}
          />

          {error && <p className="text-xs text-danger mt-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!key.trim() || saving}
            className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors"
          >
            {saving ? "Saving..." : "Save Key"}
          </button>
        </div>
      </div>
    </div>
  );
}
