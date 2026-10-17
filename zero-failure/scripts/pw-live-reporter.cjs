// The run desk's live wire into the harness. Playwright loads this as
// an extra reporter while a repo's own suite runs: every test begin
// and end, every step begin, is written as one @@ZFNOW@@ line onto the
// harness's stdout, which the desk streams into the panel — so the
// browser watches which file, which line, which block and which step
// is on stage the moment it happens, not only when the line reporter
// gets around to printing at a test's end. Loaded by path (see the
// plugin); CommonJS so it runs no matter what "type" either
// package.json declares. A reporter must never break the run it
// narrates — every hook is guarded.

const PREFIX = "@@ZFNOW@@";
const cap = (text, max = 200) => {
  const line = String(text ?? "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};
const say = (payload) => {
  try {
    console.log(PREFIX + JSON.stringify(payload));
  } catch {
    // narration dies quieter than the run
  }
};
const fileOf = (test) => test?.location?.file ?? "";
const blockOf = (test) => {
  try {
    // the describe chain — titlePath ends with the test's own title
    return test.titlePath().slice(0, -1).join(" › ");
  } catch {
    return "";
  }
};
const projectOf = (test) => {
  try {
    return test.parent?.project()?.name ?? "";
  } catch {
    return "";
  }
};

class PwLiveReporter {
  printsToStdio() {
    return true;
  }

  onBegin(_config, suite) {
    let total = 0;
    try {
      total = suite.allTests().length;
    } catch {
      total = 0;
    }
    say({ phase: "begin", total });
  }

  onTestBegin(test) {
    say({
      phase: "test",
      project: projectOf(test),
      file: fileOf(test),
      line: test.location?.line,
      block: blockOf(test),
      title: cap(test.title),
    });
  }

  onStepBegin(test, _result, step) {
    // fixture wiring repeats per test and tells nothing — skip it; the
    // real movement (hooks, goto, fill, click, expect) streams
    if (step.category === "fixture") return;
    const chain = [];
    let node = step;
    let guard = 0;
    while (node && guard < 8) {
      if (node.title) chain.unshift(node.title);
      node = node.parent;
      guard += 1;
    }
    say({
      phase: "step",
      file: fileOf(test),
      line: step.location?.line ?? test.location?.line,
      block: blockOf(test),
      title: cap(test.title),
      step: cap(chain.join(" › ")),
    });
  }

  onStepEnd(_test, _result, step) {
    if (!step.error) return;
    say({
      phase: "step-error",
      step: cap(step.title),
      error: cap(step.error.message ?? "", 240),
    });
  }

  onTestEnd(test, result) {
    say({
      phase: "test-end",
      project: projectOf(test),
      file: fileOf(test),
      title: cap(test.title),
      ok: result.status === "passed" || result.status === "skipped",
      status: result.status,
      durationMs: Math.round(result.duration ?? 0),
    });
  }

  onEnd(result) {
    say({ phase: "end", status: result?.status ?? "" });
  }
}

module.exports = PwLiveReporter;
