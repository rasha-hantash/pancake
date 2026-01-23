export interface StackBranch {
  name: string;
  prTitle: string;
  prNumber: number;
  status: "current" | "default";
}

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: "added" | "removed" | "context" | "hunk-header";
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  status: "added" | "modified";
  hunks: DiffHunk[];
}

export interface Comment {
  id: string;
  author: string;
  file: string;
  lineRange: [number, number];
  body: string;
  date: string;
  status: "pending" | "resolved";
  fixedByClaudeSuggestion?: {
    before: string;
    after: string;
  };
}

export const stackBranches: StackBranch[] = [
  { name: "feature-c", prTitle: "Add session management", prNumber: 142, status: "current" },
  { name: "feature-b", prTitle: "Auth middleware refactor", prNumber: 141, status: "default" },
  { name: "feature-a", prTitle: "Login endpoint updates", prNumber: 140, status: "default" },
  { name: "main", prTitle: "", prNumber: 0, status: "default" },
];

export const changedFiles: ChangedFile[] = [
  { path: "src/auth/login.ts", additions: 12, deletions: 3 },
  { path: "src/auth/middleware.ts", additions: 8, deletions: 15 },
  { path: "src/auth/session.ts", additions: 25, deletions: 0 },
  { path: "src/auth/auth.test.ts", additions: 34, deletions: 2 },
];

export const diffFiles: Record<string, DiffFile> = {
  "src/auth/session.ts": {
    path: "src/auth/session.ts",
    status: "added",
    hunks: [
      {
        header: "@@ -0,0 +1,25 @@",
        lines: [
          { lineNumber: 1, content: 'import { Redis } from "ioredis";', type: "added" },
          { lineNumber: 2, content: 'import { randomUUID } from "crypto";', type: "added" },
          { lineNumber: 3, content: "", type: "added" },
          { lineNumber: 4, content: "interface SessionData {", type: "added" },
          { lineNumber: 5, content: "  userId: string;", type: "added" },
          { lineNumber: 6, content: "  role: string;", type: "added" },
          { lineNumber: 7, content: "  expiresAt: number;", type: "added" },
          { lineNumber: 8, content: "}", type: "added" },
          { lineNumber: 9, content: "", type: "added" },
          { lineNumber: 10, content: "export class SessionManager {", type: "added" },
          { lineNumber: 11, content: "  private redis: Redis;", type: "added" },
          { lineNumber: 12, content: "", type: "added" },
          { lineNumber: 13, content: "  constructor(redisUrl: string) {", type: "added" },
          { lineNumber: 14, content: "    this.redis = new Redis(redisUrl);", type: "added" },
          { lineNumber: 15, content: "  }", type: "added" },
          { lineNumber: 16, content: "", type: "added" },
          { lineNumber: 17, content: "  async create(userId: string, role: string): Promise<string> {", type: "added" },
          { lineNumber: 18, content: "    const sessionId = randomUUID();", type: "added" },
          { lineNumber: 19, content: "    const data: SessionData = {", type: "added" },
          { lineNumber: 20, content: "      userId,", type: "added" },
          { lineNumber: 21, content: "      role,", type: "added" },
          { lineNumber: 22, content: "      expiresAt: Date.now() + 86400000,", type: "added" },
          { lineNumber: 23, content: "    };", type: "added" },
          { lineNumber: 24, content: '    await this.redis.set(`session:${sessionId}`, JSON.stringify(data));', type: "added" },
          { lineNumber: 25, content: "    return sessionId;", type: "added" },
          { lineNumber: 26, content: "  }", type: "added" },
          { lineNumber: 27, content: "}", type: "added" },
        ],
      },
    ],
  },
  "src/auth/login.ts": {
    path: "src/auth/login.ts",
    status: "modified",
    hunks: [
      {
        header: "@@ -5,8 +5,17 @@",
        lines: [
          { lineNumber: 5, content: 'import { validateCredentials } from "./validate";', type: "context" },
          { lineNumber: 6, content: 'import { rateLimiter } from "./middleware";', type: "context" },
          { lineNumber: 7, content: "", type: "context" },
          { lineNumber: 8, content: "export async function handleLogin(req: Request): Promise<Response> {", type: "removed" },
          { lineNumber: 9, content: "  const { email, password } = await req.json();", type: "removed" },
          { lineNumber: 10, content: "  const user = await validateCredentials(email, password);", type: "removed" },
          { lineNumber: 8, content: "export async function handleLogin(", type: "added" },
          { lineNumber: 9, content: "  req: Request,", type: "added" },
          { lineNumber: 10, content: "  sessionMgr: SessionManager", type: "added" },
          { lineNumber: 11, content: "): Promise<Response> {", type: "added" },
          { lineNumber: 12, content: "  const { email, password } = await req.json();", type: "added" },
          { lineNumber: 13, content: "  const user = await validateCredentials(email, password);", type: "added" },
          { lineNumber: 14, content: "", type: "added" },
          { lineNumber: 15, content: "  if (!user) {", type: "added" },
          { lineNumber: 16, content: '    return new Response(JSON.stringify({ error: "Invalid credentials" }), {', type: "added" },
          { lineNumber: 17, content: "      status: 401,", type: "added" },
          { lineNumber: 18, content: "    });", type: "added" },
          { lineNumber: 19, content: "  }", type: "added" },
        ],
      },
    ],
  },
  "src/auth/middleware.ts": {
    path: "src/auth/middleware.ts",
    status: "modified",
    hunks: [
      {
        header: "@@ -1,20 +1,13 @@",
        lines: [
          { lineNumber: 1, content: 'import { SessionManager } from "./session";', type: "added" },
          { lineNumber: 2, content: "", type: "added" },
          { lineNumber: 1, content: "// Legacy session check - to be removed", type: "removed" },
          { lineNumber: 2, content: "function checkSessionCookie(req: Request): boolean {", type: "removed" },
          { lineNumber: 3, content: '  const cookie = req.headers.get("cookie");', type: "removed" },
          { lineNumber: 4, content: '  return cookie?.includes("session=") ?? false;', type: "removed" },
          { lineNumber: 5, content: "}", type: "removed" },
          { lineNumber: 6, content: "", type: "removed" },
          { lineNumber: 3, content: "export async function authMiddleware(", type: "added" },
          { lineNumber: 4, content: "  req: Request,", type: "added" },
          { lineNumber: 5, content: "  sessionMgr: SessionManager", type: "added" },
          { lineNumber: 6, content: "): Promise<Response | null> {", type: "added" },
          { lineNumber: 7, content: '  const token = req.headers.get("authorization")?.replace("Bearer ", "");', type: "added" },
          { lineNumber: 8, content: "  if (!token) {", type: "added" },
          { lineNumber: 9, content: '    return new Response("Unauthorized", { status: 401 });', type: "added" },
          { lineNumber: 10, content: "  }", type: "added" },
          { lineNumber: 11, content: "  const session = await sessionMgr.get(token);", type: "added" },
          { lineNumber: 12, content: "  if (!session) {", type: "added" },
          { lineNumber: 13, content: '    return new Response("Session expired", { status: 401 });', type: "added" },
          { lineNumber: 14, content: "  }", type: "context" },
          { lineNumber: 15, content: "  return null;", type: "context" },
          { lineNumber: 16, content: "}", type: "context" },
        ],
      },
    ],
  },
  "src/auth/auth.test.ts": {
    path: "src/auth/auth.test.ts",
    status: "modified",
    hunks: [
      {
        header: "@@ -1,5 +1,37 @@",
        lines: [
          { lineNumber: 1, content: 'import { describe, it, expect, beforeEach } from "vitest";', type: "added" },
          { lineNumber: 2, content: 'import { SessionManager } from "./session";', type: "added" },
          { lineNumber: 3, content: 'import { handleLogin } from "./login";', type: "added" },
          { lineNumber: 4, content: "", type: "added" },
          { lineNumber: 1, content: 'import { describe, it, expect } from "vitest";', type: "removed" },
          { lineNumber: 2, content: 'import { handleLogin } from "./login";', type: "removed" },
          { lineNumber: 5, content: "", type: "context" },
          { lineNumber: 6, content: 'describe("auth", () => {', type: "context" },
          { lineNumber: 7, content: "  let sessionMgr: SessionManager;", type: "added" },
          { lineNumber: 8, content: "", type: "added" },
          { lineNumber: 9, content: "  beforeEach(() => {", type: "added" },
          { lineNumber: 10, content: '    sessionMgr = new SessionManager("redis://localhost:6379");', type: "added" },
          { lineNumber: 11, content: "  });", type: "added" },
          { lineNumber: 12, content: "", type: "added" },
          { lineNumber: 13, content: '  it("should create a session on valid login", async () => {', type: "added" },
          { lineNumber: 14, content: "    const req = new Request(\"http://localhost/login\", {", type: "added" },
          { lineNumber: 15, content: '      method: "POST",', type: "added" },
          { lineNumber: 16, content: "      body: JSON.stringify({ email: \"test@example.com\", password: \"pass123\" }),", type: "added" },
          { lineNumber: 17, content: "    });", type: "added" },
          { lineNumber: 18, content: "    const res = await handleLogin(req, sessionMgr);", type: "added" },
          { lineNumber: 19, content: "    expect(res.status).toBe(200);", type: "added" },
          { lineNumber: 20, content: "    const body = await res.json();", type: "added" },
          { lineNumber: 21, content: "    expect(body.sessionId).toBeDefined();", type: "added" },
          { lineNumber: 22, content: "  });", type: "added" },
          { lineNumber: 23, content: "", type: "added" },
          { lineNumber: 24, content: '  it("should reject invalid credentials", async () => {', type: "added" },
          { lineNumber: 25, content: "    const req = new Request(\"http://localhost/login\", {", type: "added" },
          { lineNumber: 26, content: '      method: "POST",', type: "added" },
          { lineNumber: 27, content: "      body: JSON.stringify({ email: \"bad@example.com\", password: \"wrong\" }),", type: "added" },
          { lineNumber: 28, content: "    });", type: "added" },
          { lineNumber: 29, content: "    const res = await handleLogin(req, sessionMgr);", type: "added" },
          { lineNumber: 30, content: "    expect(res.status).toBe(401);", type: "added" },
          { lineNumber: 31, content: "  });", type: "added" },
          { lineNumber: 32, content: "});", type: "context" },
        ],
      },
    ],
  },
};

export const comments: Comment[] = [
  {
    id: "c1",
    author: "alice",
    file: "src/auth/login.ts",
    lineRange: [12, 12],
    body: "The email is being passed directly into the query without sanitization. This could be vulnerable to SQL injection if validateCredentials uses raw queries.",
    date: "2h ago",
    status: "pending",
  },
  {
    id: "c2",
    author: "bob",
    file: "src/auth/login.ts",
    lineRange: [8, 11],
    body: "Should we add rate limiting to the login endpoint? The rateLimiter import is unused.",
    date: "1h ago",
    status: "pending",
  },
  {
    id: "c3",
    author: "alice",
    file: "src/auth/session.ts",
    lineRange: [22, 22],
    body: "The session TTL is hardcoded to 24h. Consider making this configurable via an environment variable.",
    date: "3h ago",
    status: "resolved",
    fixedByClaudeSuggestion: {
      before: "      expiresAt: Date.now() + 86400000,",
      after: "      expiresAt: Date.now() + (parseInt(process.env.SESSION_TTL_MS ?? \"86400000\")),",
    },
  },
];
