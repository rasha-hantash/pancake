import { useState } from "react";
import { StackSidebar } from "./components/StackSidebar";
import { DiffView } from "./components/DiffView";
import { CommentsPanel } from "./components/CommentsPanel";

function App() {
  const [selectedFile, setSelectedFile] = useState("src/auth/session.ts");
  const [activeTab, setActiveTab] = useState<"comments" | "claude">("comments");

  return (
    <div className="flex h-screen bg-[#141414]">
      <StackSidebar selectedFile={selectedFile} onFileSelect={setSelectedFile} />
      <DiffView selectedFile={selectedFile} />
      <CommentsPanel activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
