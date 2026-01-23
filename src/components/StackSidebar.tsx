import { stackBranches, changedFiles } from "../data/mockData";

interface StackSidebarProps {
  selectedFile: string;
  onFileSelect: (path: string) => void;
}

export function StackSidebar({ selectedFile, onFileSelect }: StackSidebarProps) {
  return (
    <div className="flex h-full w-[240px] flex-col border-r border-[#2a2a2a] bg-[#1a1a1a]">
      <div className="border-b border-[#2a2a2a] px-3 py-2">
        <span className="text-xs font-medium text-[#888]">Stack</span>
      </div>
      <div className="border-b border-[#2a2a2a] py-1">
        {stackBranches.map((branch) => (
          <div
            key={branch.name}
            className="flex items-center gap-2 px-3 py-1"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                branch.status === "current" ? "bg-[#4e9af5]" : "bg-[#555]"
              }`}
            />
            <span
              className={`text-xs ${
                branch.status === "current" ? "text-[#e0e0e0]" : "text-[#888]"
              }`}
            >
              {branch.name}
            </span>
            {branch.prNumber > 0 && (
              <span className="text-xs text-[#555]">#{branch.prNumber}</span>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2">
        <span className="text-xs font-medium text-[#888]">Changed Files</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {changedFiles.map((file) => (
          <button
            key={file.path}
            onClick={() => onFileSelect(file.path)}
            className={`flex w-full items-center justify-between px-3 py-1 text-left hover:bg-[#252525] ${
              selectedFile === file.path ? "bg-[#252525]" : ""
            }`}
          >
            <span
              className={`truncate text-xs ${
                selectedFile === file.path ? "text-[#e0e0e0]" : "text-[#888]"
              }`}
            >
              {file.path.split("/").pop()}
            </span>
            <span className="ml-2 shrink-0 text-xs">
              <span className="text-[#3fb950]">+{file.additions}</span>
              {file.deletions > 0 && (
                <span className="ml-1 text-[#f85149]">-{file.deletions}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
