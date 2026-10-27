// One label table for assertion statuses — the results dashboard and the
// report view must name outcomes identically, and a third hand-rolled copy
// would only drift.
import type { AssertionStatus } from "../../engine/types";

export const ASSERTION_STATUS_LABEL: Record<AssertionStatus, string> = {
  passed: "passed",
  failed: "failed",
  warning: "warning",
  "not-tested": "not tested",
  "not-configured": "not configured"
};
