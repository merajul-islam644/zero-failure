// The dev server's run desk. The playwright sector connects an app's
// repo — its folder, summarized read-only; pressing play asks this
// endpoint to run THAT repo's own playwright suite from where the repo
// lives on this machine: the repo's own config, its own .env
// credentials, its own tests. The app's play runs the whole suite; a
// menu's play aims the harness at its connected folder's chain of
// code. Dev only: a built app carries no run desk. The response
// streams whitespace while the suite grinds so nothing between here
// and the browser calls the pipe dead, then lands the JSON reporter's
// verdict.

import { spawn } from "node:child_process";
import { readFile, readdir, stat, unlink } from "node:fs/promises";
import { existsSync, type Dirent } from "node:fs";
import type { ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";

/** The body cap — a run request is a path and a label; anything past
 *  this is not one. */
const MAX_BODY_BYTES = 1_000_000;
/** The whole run's ceiling — a repo's own config can burn ten minutes
 *  on its webServer alone before a single test; fifteen is the honest
 *  stop, and the panel's Stop button is the sooner way out. */
const RUN_TIMEOUT_MS = 900_000;
/** Keepalive pace — a ping line on the wire so idle stretches (a web
 *  server booting, a sign-in grinding) never read as dead. */
const KEEPALIVE_MS = 15_000;
/** The live reporter's narration prefix — stdout lines wearing it are
 *  `now` frames (which file, which line, which block, which step), not
 *  log chatter. */
const NOW_PREFIX = "@@ZFNOW@@";

interface RunRequest {
  rootPath?: unknown;
  rel?: unknown;
  /** The hunt: a picked folder's name, when the browser kept its path
   *  to itself — the desk searches this machine for a folder of that
   *  name wearing a playwright config. */
  find?: { rootName?: unknown };
}

export interface RunStats {
  passed: number;
  failed: number;
  skipped: number;
}

export interface RunTest {
  title: string;
  ok: boolean;
  status?: string;
  message?: string;
}

interface RunResponse {
  ok: boolean;
  durationMs?: number;
  stats?: RunStats;
  tests?: RunTest[];
  error?: string;
  /** The hunt's answers — the homes on this machine the repo could be. */
  matches?: string[];
  /** The folder the harness actually ran from — the repo root the desk
   *  climbed to, which may sit above the folder the browser knew. */
  ranFrom?: string;
}

/** The JSON reporter's shape, as far as the desk reads it. */
interface JsonReport {
  suites?: JsonSuite[];
  errors?: { message?: string }[];
}

interface JsonSuite {
  title?: string;
  suites?: JsonSuite[];
  specs?: JsonSpec[];
}

interface JsonSpec {
  title?: string;
  tests?: {
    projectName?: string;
    status?: string;
    results?: { status?: string; error?: { message?: string } }[];
  }[];
}

/** The config names that mark a repo as runnable by its own harness. */
const CONFIG_NAMES = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.cjs",
];

export function playwrightRunPlugin(): Plugin {
  return {
    name: "zf-playwright-run",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/playwright-run", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        let overflow = false;
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString("utf8");
          if (body.length > MAX_BODY_BYTES) {
            overflow = true;
            req.destroy();
          }
        });
        req.on("end", () => {
          if (!overflow) void handleRun(body, res);
        });
      });
    },
  };
}

async function handleRun(raw: string, res: ServerResponse): Promise<void> {
  let parsed: RunRequest;
  try {
    parsed = JSON.parse(raw) as RunRequest;
  } catch {
    finish(res, { ok: false, error: "Malformed run request." });
    return;
  }
  // The hunt comes first: a play press without a home on file asks the
  // desk to find the repo by the root folder's own name — the name rode
  // the connect, so nobody types a path the desk can find itself.
  if (parsed.find && typeof parsed.find.rootName === "string" && parsed.find.rootName.trim()) {
    finish(res, { ok: true, matches: await scanMachine(parsed.find.rootName) });
    return;
  }
  const rootPath =
    typeof parsed.rootPath === "string" && parsed.rootPath.trim()
      ? path.resolve(parsed.rootPath.trim())
      : "";
  if (!rootPath) {
    finish(res, {
      ok: false,
      error: "No folder path came with the run — the app's repo needs its home on this machine.",
    });
    return;
  }
  let isFolder = false;
  try {
    isFolder = (await stat(rootPath)).isDirectory();
  } catch {
    isFolder = false;
  }
  if (!isFolder) {
    finish(res, { ok: false, error: `That path is not a folder on this machine: ${rootPath}` });
    return;
  }
  const hasConfig = await folderHasConfig(rootPath);
  // The aim: a menu's play runs its connected folder's chain of code,
  // the app's play runs the whole suite. A malformed chain aims nowhere.
  const rel = sanitizeRel(parsed.rel);
  let runFrom = rootPath;
  let aim =
    rel.length > 0
      ? // the CLI filter is a regex against file paths — tame the names
        rel.join("/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : null;
  if (!hasConfig) {
    // The config lives at the repo's root, but the folder the browser
    // knows may sit deep inside — a connected sub-folder, a pasted
    // path. Climb until a config appears; the steps climbed become the
    // aim, so the harness still runs exactly this folder's tests.
    let up = path.dirname(rootPath);
    let chain = path.basename(rootPath);
    let found = false;
    while (up !== path.dirname(up)) {
      if (await folderHasConfig(up)) {
        found = true;
        break;
      }
      chain = `${path.basename(up)}/${chain}`;
      up = path.dirname(up);
    }
    if (!found) {
      finish(res, {
        ok: false,
        error: `No playwright.config found in ${rootPath} or any folder above it — this repo's tests cannot be run from here.`,
      });
      return;
    }
    runFrom = up;
    aim = chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  // A repo without its own playwright installed leaves npx asking "Ok
  // to proceed?" on a stdin nobody reads — a hang dressed as a run.
  // The local install is the one that must answer; fail fast instead.
  let installed = false;
  for (const marker of [
    "node_modules/@playwright/test",
    "node_modules/playwright",
    "node_modules/.bin/playwright.cmd",
    "node_modules/.bin/playwright",
  ]) {
    try {
      const info = await stat(path.join(runFrom, marker));
      if (info.isFile() || info.isDirectory()) {
        installed = true;
        break;
      }
    } catch {
      // next candidate marker
    }
  }
  if (!installed) {
    finish(res, {
      ok: false,
      error: `Playwright is not installed in ${runFrom} — install this repo's dependencies there first (npm install inside it), then press play again.`,
    });
    return;
  }
  // the report file the json reporter writes — a private scratch name
  const reportPath = path.join(
    os.tmpdir(),
    `zf-run-report-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
  // the desk's live reporter rides along with the plain pair — its
  // narration is what shows the file, the line, the block and the step
  // while a test grinds; a missing file leaves the plain pair to run
  const liveReporter = path.resolve(process.cwd(), "scripts", "pw-live-reporter.cjs");
  const reporters = existsSync(liveReporter) ? `${liveReporter},line,json` : "line,json";
  const child = spawn(
    "npx",
    ["playwright", "test", ...(aim ? [aim] : []), `--reporter=${reporters}`],
    {
      cwd: runFrom,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        // the line reporter rides stdout live — the panel streams it;
        // the json report lands in a file via the env overrides, so the
        // wire stays event lines. A version that ignores the overrides
        // prints its json onto stdout too — the desk still finds it
        // there when the file never shows up.
        PLAYWRIGHT_JSON_OUTPUT_DIR: path.dirname(reportPath),
        PLAYWRIGHT_JSON_OUTPUT_NAME: path.basename(reportPath),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const started = Date.now();
  let stdout = "";
  let stderr = "";
  // the wire is ndjson: one event per line — the harness's own chatter
  // as it happens, pinged while quiet, the verdict as the last line
  res.writeHead(200, { "cache-control": "no-store", "content-type": "application/x-ndjson" });
  const send = (event: Record<string, unknown>) => {
    try {
      res.write(`${JSON.stringify(event)}\n`);
    } catch {
      // the viewer is gone; the close handler kills the run
    }
  };
  const MAX_FORWARD_LINES = 4000;
  const MAX_LINE_CHARS = 600;
  let forwarded = 0;
  let truncationNoted = false;
  const emit = (raw: string, stream: "out" | "err") => {
    const text = raw.trimEnd();
    if (!text) return;
    // the live reporter narrates in @@ZFNOW@@ lines — those become
    // `now` frames on the wire, not log chatter, so the panel can show
    // the file, the line, the block and the step on stage this second
    if (stream === "out" && text.startsWith(NOW_PREFIX)) {
      try {
        send({ type: "now", now: JSON.parse(text.slice(NOW_PREFIX.length)) });
      } catch {
        // a torn narration line dies quietly; the next one lands whole
      }
      return;
    }
    if (forwarded >= MAX_FORWARD_LINES) {
      if (!truncationNoted) {
        truncationNoted = true;
        send({ type: "log", stream, text: "… output truncated — the verdict still lands …" });
      }
      return;
    }
    forwarded += 1;
    send({
      type: "log",
      stream,
      text: text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS)}…` : text,
    });
  };
  const splitter = (stream: "out" | "err") => {
    let part = "";
    return {
      push(chunk: string) {
        part += chunk;
        let idx = part.indexOf("\n");
        while (idx >= 0) {
          emit(part.slice(0, idx), stream);
          part = part.slice(idx + 1);
          idx = part.indexOf("\n");
        }
      },
      flush() {
        if (part.trim()) emit(part, stream);
        part = "";
      },
    };
  };
  const splitOut = splitter("out");
  const splitErr = splitter("err");
  const keepalive = setInterval(() => send({ type: "ping" }), KEEPALIVE_MS);
  send({ type: "start", ranFrom: runFrom, aim });
  const killRun = () => {
    if (!child.pid) return;
    if (process.platform === "win32") {
      // shell:true wraps npx — killing the shell alone orphans the harness
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGKILL");
    }
  };
  let done = false;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killRun();
  }, RUN_TIMEOUT_MS);
  const finishRun = (payload: RunResponse) => {
    if (done) return;
    done = true;
    clearInterval(keepalive);
    clearTimeout(timer);
    send({ type: "done", payload });
    try {
      res.end();
    } catch {
      // the viewer is gone; the verdict dies with the pipe
    }
  };
  // the report read back — the file the json reporter wrote first,
  // stdout's blob as the fallback for versions that ignored the env
  // overrides — then the verdict as the stream's last line
  const land = async () => {
    if (done) return;
    splitOut.flush();
    splitErr.flush();
    let report: JsonReport | null = null;
    try {
      report = JSON.parse(await readFile(reportPath, "utf8")) as JsonReport;
    } catch {
      report = null;
    }
    if (!report) {
      const start = stdout.indexOf("{");
      const end = stdout.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          report = JSON.parse(stdout.slice(start, end + 1)) as JsonReport;
        } catch {
          report = null;
        }
      }
    }
    try {
      await unlink(reportPath);
    } catch {
      // nothing to sweep up
    }
    const durationMs = Date.now() - started;
    if (!report) {
      finishRun({
        ok: false,
        ranFrom: runFrom,
        durationMs,
        error: timedOut
          ? `The run hit the desk's ${Math.round(RUN_TIMEOUT_MS / 60_000)}-minute ceiling and was killed with nothing to show — a harness waiting on its web server or a sign-in that never answers looks like this.`
          : `The runner printed no report.${stderr.trim() ? ` ${stderr.slice(-400).trim()}` : ""}`,
      });
      return;
    }
    const tests = collectTests(report);
    // A failed setup project (a sign-in gate, most often) means every
    // walk row is an empty shell ("never ran") — the panel deserves the
    // gate's own failure instead.
    const setupFailed = findSetupFailure(report);
    if (setupFailed && tests.every((test) => !test.status || test.status === "no result")) {
      finishRun({
        ok: true,
        ranFrom: runFrom,
        durationMs,
        stats: { passed: 0, failed: 0, skipped: 0 },
        tests: [],
        error: `A setup project failed before the tests, so no test ran. ${setupFailed}`,
      });
      return;
    }
    finishRun({
      ok: true,
      ranFrom: runFrom,
      durationMs,
      stats: {
        passed: tests.filter((test) => test.ok).length,
        failed: tests.filter((test) => !test.ok && test.status !== "skipped").length,
        skipped: tests.filter((test) => test.status === "skipped").length,
      },
      tests,
      error: tests.length === 0 ? firstFailure(report, stderr) : undefined,
    });
  };
  // the console moved on (closed, navigated): kill the run, keep the desk
  res.on("close", () => {
    if (!done) killRun();
  });
  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    stdout += text;
    if (stdout.length > 8_000_000) stdout = stdout.slice(-4_000_000);
    splitOut.push(text);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    stderr += text;
    if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    splitErr.push(text);
  });
  child.on("error", (error) => {
    finishRun({ ok: false, ranFrom: runFrom, error: `The runner never started — ${error.message}` });
  });
  child.on("close", () => {
    void land();
  });
}

/** The folder chain the browser sent — each segment a plain folder name;
 *  anything else aims the run nowhere (the whole suite instead). */
function sanitizeRel(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return [];
    const segment = entry.trim();
    if (!segment || segment === "." || segment === ".." || /[\\/:*?"<>|]/.test(segment)) return [];
    out.push(segment);
  }
  return out;
}

/** A repo runs when one of the known config names sits right in it. */
async function folderHasConfig(folder: string): Promise<boolean> {
  for (const name of CONFIG_NAMES) {
    try {
      if ((await stat(path.join(folder, name))).isFile()) return true;
    } catch {
      // next candidate name
    }
  }
  return false;
}

/** The hunt's ceiling — the machine is not the repo; twenty seconds and
 *  five answers are plenty to find the honest home. */
const SCAN_BUDGET_MS = 20_000;
const SCAN_MAX_MATCHES = 5;
const SCAN_DEPTH = 3;

/** The desk searches this machine for a folder of the given name that
 *  directly wears a playwright config — bounded: three levels below the
 *  usual roots, a time budget, a fistful of answers. The browser keeps
 *  a picked folder's path to itself; this is how the desk still finds
 *  it without asking anyone to type. */
async function scanMachine(rootName: string): Promise<string[]> {
  const wanted = rootName.trim().toLowerCase();
  if (!wanted) return [];
  const matches: string[] = [];
  const deadline = Date.now() + SCAN_BUDGET_MS;
  const skip = new Set([
    "node_modules",
    ".git",
    "appdata",
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "$recycle.bin",
    "system volume information",
    "recovery",
  ]);
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (Date.now() > deadline || matches.length >= SCAN_MAX_MATCHES) return;
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable — not the desk's to judge
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const lower = entry.name.toLowerCase();
      if (skip.has(lower) || lower.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (lower === wanted && (await folderHasConfig(full))) {
        matches.push(full);
        continue; // a namesake never grows another namesake beneath it
      }
      if (depth > 0) await walk(full, depth - 1);
    }
  };
  for (const root of await candidateRoots()) {
    if (matches.length >= SCAN_MAX_MATCHES || Date.now() > deadline) break;
    await walk(root, SCAN_DEPTH);
  }
  return matches;
}

/** Where the hunt starts — every drive that answers, plus the user
 *  profile's usual workbenches (their deeper shelves ride the drive
 *  walk's depth). */
async function candidateRoots(): Promise<string[]> {
  const roots: string[] = [];
  for (let code = 65; code <= 90; code += 1) {
    const drive = `${String.fromCharCode(code)}:\\`;
    try {
      if ((await stat(drive)).isDirectory()) roots.push(drive);
    } catch {
      // no such drive
    }
  }
  for (const bench of ["Desktop", "Documents", "Downloads"]) {
    roots.push(path.join(os.homedir(), bench));
  }
  return roots;
}

/** The report's specs flattened — one row per test, the last attempt's
 *  verdict standing (a retried pass is a pass). A setup project's own
 *  tests stay out of the rows: they are the ride-along, not the suite. */
function collectTests(report: JsonReport): RunTest[] {
  const rows: RunTest[] = [];
  const push = (spec: JsonSpec) => {
    const test = spec.tests?.[spec.tests.length - 1];
    if (!test || test.projectName === "setup") return;
    const result = test.results?.[test.results.length - 1];
    const status = result?.status ?? test.status ?? "no result";
    rows.push({
      title: spec.title ?? "spec",
      ok: status === "passed",
      status,
      message:
        status === "passed" || status === "skipped"
          ? undefined
          : status === "no result"
            ? "The harness never ran this test — a setup project before it failed."
            : (result?.error?.message ?? `status: ${status}`).slice(0, 1200),
    });
  };
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) push(spec);
    for (const nested of suite.suites ?? []) walk(nested);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return rows;
}

/** No rows at all — the run died before them (a setup gate, a config
 *  error). The report's own errors, then the setup spec, then stderr's
 *  tail, say which. */
function firstFailure(report: JsonReport, stderr: string): string {
  const reported = report.errors?.find((error) => error.message)?.message;
  if (reported) return reported.slice(0, 1200);
  const setup = findSetupFailure(report);
  if (setup) return setup;
  const tail = stderr.trim();
  return tail
    ? `The run finished with nothing to show. ${tail.slice(-800)}`
    : "The run finished with nothing to show.";
}

function findSetupFailure(report: JsonReport): string | undefined {
  let found: string | undefined;
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      if (found) return;
      const test = spec.tests?.find((entry) => entry.projectName === "setup");
      const result = test?.results?.[test.results.length - 1];
      if (result && result.status !== "passed") {
        found = `${spec.title ?? "Setup"} failed — ${result.error?.message ?? result.status}`;
      }
    }
    for (const nested of suite.suites ?? []) walk(nested);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return found?.slice(0, 1200);
}

function finish(res: ServerResponse, payload: RunResponse): void {
  if (res.writableEnded) return;
  try {
    res.end(JSON.stringify(payload));
  } catch {
    // the viewer is gone; the verdict dies with the pipe
  }
}
