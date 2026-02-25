import type {
  Branch,
  GitLogEntry,
  GitDiffResult,
  RepoWithStatus,
  Comment,
  Stack,
} from "../api/types";

// ── Mock Repos ──

export const mockRepos: RepoWithStatus[] = [
  {
    meta: {
      path: "/Users/dev/projects/pancake",
      display_name: "pancake",
      vcs: "Git",
      has_graphite: true,
      base_branch: "main",
    },
    has_any_attention: true,
    branch_statuses: {
      "feat/add-validation": true,
      "feat/refactor-api": true,
      "fix/login-bug": false,
    },
  },
  {
    meta: {
      path: "/Users/dev/projects/backend-api",
      display_name: "backend-api",
      vcs: "Git",
      has_graphite: false,
      base_branch: "main",
    },
    has_any_attention: false,
    branch_statuses: {},
  },
];

// ── Mock Branches ──

export const mockBranches: Branch[] = [
  {
    name: "main",
    commit_hash: "a1b2c3d",
    is_current: false,
    ahead_count: 0,
    behind_count: 0,
  },
  {
    name: "feat/add-validation",
    commit_hash: "d4e5f6a",
    is_current: true,
    ahead_count: 3,
    behind_count: 0,
  },
  {
    name: "feat/refactor-api",
    commit_hash: "b7c8d9e",
    is_current: false,
    ahead_count: 2,
    behind_count: 1,
  },
  {
    name: "fix/login-bug",
    commit_hash: "f0a1b2c",
    is_current: false,
    ahead_count: 1,
    behind_count: 0,
  },
];

// ── Mock Git Log ──

export const mockGitLog: GitLogEntry[] = [
  {
    commit_id: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
    author: "developer@example.com",
    timestamp: "2 hours ago",
    description: "Add input validation for user registration form",
    branches: ["feat/add-validation"],
  },
  {
    commit_id: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
    author: "developer@example.com",
    timestamp: "3 hours ago",
    description: "Extract shared types into types.ts module",
    branches: [],
  },
  {
    commit_id: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
    author: "developer@example.com",
    timestamp: "4 hours ago",
    description: "Refactor error handling in API client",
    branches: [],
  },
];

// ── Mock Git Diff ──

export const mockGitDiff: GitDiffResult = {
  branch: "feat/add-validation",
  description: "Add input validation for user registration form",
  patch: `diff --git a/src/components/RegisterForm.tsx b/src/components/RegisterForm.tsx
index 3a1b2c3..d4e5f6a 100644
--- a/src/components/RegisterForm.tsx
+++ b/src/components/RegisterForm.tsx
@@ -1,5 +1,6 @@
 import { useState } from "react";
 import { useAuth } from "../hooks/useAuth";
+import { validateEmail, validatePassword } from "../utils/validation";

 interface FormState {
   email: string;
@@ -8,6 +9,7 @@ interface FormState {

 interface FormErrors {
   email?: string;
+  password?: string;
 }

 export function RegisterForm() {
@@ -16,12 +18,29 @@ export function RegisterForm() {
   const [errors, setErrors] = useState<FormErrors>({});
   const { register } = useAuth();

+  function validate(): boolean {
+    const newErrors: FormErrors = {};
+
+    if (!validateEmail(form.email)) {
+      newErrors.email = "Please enter a valid email address";
+    }
+
+    if (!validatePassword(form.password)) {
+      newErrors.password =
+        "Password must be at least 8 characters with one uppercase letter and one number";
+    }
+
+    setErrors(newErrors);
+    return Object.keys(newErrors).length === 0;
+  }
+
   async function handleSubmit(e: React.FormEvent) {
     e.preventDefault();
-    if (!form.email.includes("@")) {
-      setErrors({ email: "Invalid email" });
+    if (!validate()) {
       return;
     }
+
     try {
       await register(form.email, form.password);
     } catch (err) {
diff --git a/src/utils/validation.ts b/src/utils/validation.ts
new file mode 100644
index 0000000..a8b9c0d
--- /dev/null
+++ b/src/utils/validation.ts
@@ -0,0 +1,13 @@
+const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
+
+export function validateEmail(email: string): boolean {
+  return EMAIL_RE.test(email.trim());
+}
+
+export function validatePassword(password: string): boolean {
+  if (password.length < 8) return false;
+  if (!/[A-Z]/.test(password)) return false;
+  if (!/[0-9]/.test(password)) return false;
+  return true;
+}`,
  files_changed: ["src/components/RegisterForm.tsx", "src/utils/validation.ts"],
};

// ── Mock Comments ──

export const mockComments: Comment[] = [
  {
    id: "c001-mock",
    revision: "feat/add-validation",
    file_path: "src/components/RegisterForm.tsx",
    side: "new",
    line: 21,
    body: "The validate function mutates component state via setErrors(). Consider returning the errors object and letting the caller decide — makes this easier to unit test.",
    severity: "issue",
    created_at: "2026-02-23T10:45:00Z",
    resolved: false,
  },
  {
    id: "c002-mock",
    revision: "feat/add-validation",
    file_path: "src/components/RegisterForm.tsx",
    side: "new",
    line: 34,
    body: "Nit: you could destructure `form` in the function signature to make the dependency on email/password explicit.",
    severity: "nit",
    created_at: "2026-02-23T10:46:00Z",
    resolved: false,
  },
  {
    id: "c003-mock",
    revision: "feat/add-validation",
    file_path: "src/utils/validation.ts",
    side: "new",
    line: 3,
    body: "Should validateEmail also reject emails longer than 254 characters (RFC 5321 limit)?",
    severity: "question",
    created_at: "2026-02-23T10:47:00Z",
    resolved: false,
  },
  {
    id: "c004-mock",
    revision: "feat/add-validation",
    file_path: "src/utils/validation.ts",
    side: "new",
    line: 8,
    body: "Good: checking length, uppercase, and digit. Consider adding a special-character requirement to match OWASP guidelines.",
    severity: "note",
    created_at: "2026-02-23T10:48:00Z",
    resolved: true,
  },
];

// ── Mock Graphite Stacks ──

export const mockStacks: Stack[] = [
  {
    id: "feat/add-validation",
    entries: [
      {
        branch_name: "feat/add-validation",
        meta: {
          parent_branch: "main",
          parent_revision: "a1b2c3d4e5f6",
          pr_number: 42,
          pr_title: "Add input validation for registration",
          pr_state: "OPEN",
          pr_url: "https://github.com/example/pancake/pull/42",
        },
        commit_hash: "d4e5f6a",
        needs_attention: true,
      },
      {
        branch_name: "feat/refactor-api",
        meta: {
          parent_branch: "feat/add-validation",
          parent_revision: "d4e5f6a7b8c9",
          pr_number: 43,
          pr_title: "Refactor API client error handling",
          pr_state: "OPEN",
          pr_url: "https://github.com/example/pancake/pull/43",
        },
        commit_hash: "b7c8d9e",
        needs_attention: true,
      },
    ],
  },
];
