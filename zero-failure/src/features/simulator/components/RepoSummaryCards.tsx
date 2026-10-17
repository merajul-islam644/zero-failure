// Summary cards for a level's connected cargo — the folder walk's
// (RepoSummaryCard) and the loose files' (FilesSummaryCard). Same
// .sim-repo chrome; the planet menu modal's repository console lays
// them side by side at leaf levels.

import { formatBytes, type FilesSummary, type RepoSummary } from "../script/repoScan";

/** The connected folder's summary card — name, counts and the language
 *  bars, the same facts the walk reported. */
export function RepoSummaryCard({ repo }: { repo: RepoSummary }) {
  const total = Math.max(1, repo.bytes);
  return (
    <div className="sim-repo">
      <div className="sim-repo-head">
        <span className="sim-repo-dot" aria-hidden />
        <strong className="sim-repo-name">{repo.name}</strong>
      </div>
      <p className="sim-repo-meta">
        {repo.files.toLocaleString()} files · {repo.dirs.toLocaleString()}{" "}
        folders · {formatBytes(repo.bytes)}
      </p>
      {repo.languages.length > 0 && (
        <ul className="sim-repo-langs">
          {repo.languages.slice(0, 5).map((lang) => {
            const pct = Math.round((lang.bytes / total) * 1000) / 10;
            return (
              <li key={lang.name} className="sim-repo-lang">
                <span className="sim-repo-lang-name">{lang.name}</span>
                <span className="sim-repo-lang-bar" aria-hidden>
                  <span
                    className="sim-repo-lang-fill"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </span>
                <span className="sim-repo-lang-pct">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The picked loose files' summary card — count, total size, type bars
 *  and the named few — beside the folder card at leaf menu and sub-menu
 *  levels. */
export function FilesSummaryCard({ files }: { files: FilesSummary }) {
  return (
    <div className="sim-repo">
      <div className="sim-repo-head">
        <span className="sim-repo-dot" aria-hidden />
        <strong className="sim-repo-name">
          {files.count} {files.count === 1 ? "file" : "files"}
        </strong>
      </div>
      <p className="sim-repo-meta">{formatBytes(files.bytes)} total</p>
      {files.types.length > 0 && (
        <ul className="sim-repo-langs">
          {files.types.slice(0, 4).map((type) => {
            const pct = Math.round((type.bytes / Math.max(1, files.bytes)) * 1000) / 10;
            return (
              <li key={type.name} className="sim-repo-lang">
                <span className="sim-repo-lang-name">{type.name}</span>
                <span className="sim-repo-lang-bar" aria-hidden>
                  <span className="sim-repo-lang-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                </span>
                <span className="sim-repo-lang-pct">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="sim-repo-meta">
        {[
          ...files.files.slice(0, 3).map((file) => file.name),
          ...(files.count > 3 ? [`+${files.count - 3} more`] : []),
        ].join(" · ")}
      </p>
    </div>
  );
}
