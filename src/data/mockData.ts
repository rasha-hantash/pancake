import type { LogEntry, DiffResult, Comment } from "../api/types";

export const mockLogEntries: LogEntry[] = [
  {
    change_id: "kxmvpqzl4a7e8b3c9d0f1g2h",
    commit_id: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    author: "claude-agent",
    timestamp: "2026-02-23 10:42",
    description: "Add input validation for user registration form",
    bookmarks: ["agent/review-01"],
    is_working_copy: true,
    has_conflict: false,
  },
  {
    change_id: "rnstvwxy5b8f9c0d1e2g3h4i",
    commit_id: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
    author: "claude-agent",
    timestamp: "2026-02-23 10:38",
    description: "Refactor error handling in API client",
    bookmarks: [],
    is_working_copy: false,
    has_conflict: false,
  },
  {
    change_id: "pqmlnopq6c9g0d1e2f3h4i5j",
    commit_id: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
    author: "claude-agent",
    timestamp: "2026-02-23 10:30",
    description: "Extract shared types into types.ts module",
    bookmarks: [],
    is_working_copy: false,
    has_conflict: false,
  },
  {
    change_id: "zywxuvst7d0h1e2f3g4i5j6k",
    commit_id: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
    author: "developer",
    timestamp: "2026-02-23 09:15",
    description: "Initial project scaffold",
    bookmarks: ["main"],
    is_working_copy: false,
    has_conflict: false,
  },
];

export const mockDiff: DiffResult = {
  revision: mockLogEntries[0].change_id,
  description: mockLogEntries[0].description,
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

export const mockComments: Comment[] = [
  {
    id: "c001-mock",
    revision: mockLogEntries[0].change_id,
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
    revision: mockLogEntries[0].change_id,
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
    revision: mockLogEntries[0].change_id,
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
    revision: mockLogEntries[0].change_id,
    file_path: "src/utils/validation.ts",
    side: "new",
    line: 8,
    body: "Good: checking length, uppercase, and digit. Consider adding a special-character requirement to match OWASP guidelines.",
    severity: "note",
    created_at: "2026-02-23T10:48:00Z",
    resolved: true,
  },
];
