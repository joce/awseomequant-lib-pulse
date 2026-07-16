"use client";

import { useMemo, useState } from "react";
import data from "./libraries.json";

type Library = (typeof data.libraries)[number];

const date = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const number = new Intl.NumberFormat("en");

function releaseLabel(library: Library) {
  if (library.release?.publishedAt) return "released";
  if (library.status === "no-github-release") return "none";
  return "unavailable";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [release, setRelease] = useState("all");
  const [sort, setSort] = useState("stars");

  const sections = useMemo(
    () => [...new Set(data.libraries.map((library) => library.section))].sort(),
    [],
  );

  const libraries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.libraries
      .filter(
        (library) =>
          (!needle ||
            `${library.name} ${library.repo ?? ""} ${library.description}`
              .toLowerCase()
              .includes(needle)) &&
          (section === "all" || library.section === section) &&
          (release === "all" || releaseLabel(library) === release),
      )
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "release")
          return (b.release?.publishedAt ?? "").localeCompare(
            a.release?.publishedAt ?? "",
          );
        return (b.stars ?? -1) - (a.stars ?? -1);
      });
  }, [query, section, release, sort]);

  const released = data.libraries.filter((library) => library.release).length;
  const noRelease = data.libraries.filter(
    (library) => library.status === "no-github-release",
  ).length;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Awesome Quant · Python library pulse</p>
          <h1>Release recency and GitHub stars, in one place.</h1>
          <p className="lede">
            Every unique entry tagged <code>Python</code> in the current Awesome
            Quant README, checked against GitHub on 16 July 2026.
          </p>
        </div>
        <a className="source" href={data.source} target="_blank" rel="noreferrer">
          View source list ↗
        </a>
      </header>

      <section className="summary" aria-label="Dataset summary">
        <div><strong>{number.format(data.libraries.length)}</strong><span>Python entries</span></div>
        <div><strong>{number.format(released)}</strong><span>With a GitHub release</span></div>
        <div><strong>{number.format(noRelease)}</strong><span>Without a GitHub release</span></div>
      </section>

      <section className="controls" aria-label="Filter libraries">
        <label className="search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Library, repository, or description"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Category</span>
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="all">All categories</option>
            {sections.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Release status</span>
          <select value={release} onChange={(event) => setRelease(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="released">Has GitHub release</option>
            <option value="none">No GitHub release</option>
            <option value="unavailable">Repository unavailable</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="stars">Stars, high to low</option>
            <option value="release">Newest release</option>
            <option value="name">Library name</option>
          </select>
        </label>
      </section>

      <div className="result-count" aria-live="polite">
        Showing {number.format(libraries.length)} of {number.format(data.libraries.length)} entries
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Library</th>
              <th>Category</th>
              <th>Latest GitHub release</th>
              <th className="numeric">Stars</th>
            </tr>
          </thead>
          <tbody>
            {libraries.map((library) => {
              const href = library.repo_url ?? library.primary_url;
              return (
                <tr key={`${library.name}-${library.primary_url}`}>
                  <td>
                    <a className="library" href={href} target="_blank" rel="noreferrer">
                      {library.name} <span aria-hidden="true">↗</span>
                    </a>
                    <span className="repo">
                      {library.repo ?? "No GitHub repository"}
                      {library.archived ? " · archived" : ""}
                    </span>
                  </td>
                  <td><span className="category">{library.section}</span></td>
                  <td>
                    {library.release?.publishedAt ? (
                      <>
                        <a className="release" href={library.release.url} target="_blank" rel="noreferrer">
                          <time dateTime={library.release.publishedAt}>{date.format(new Date(library.release.publishedAt))}</time>
                        </a>
                        <span className="tag">{library.release.tagName}{library.release.isPrerelease ? " · pre-release" : ""}</span>
                      </>
                    ) : (
                      <span className="empty">
                        {library.status === "no-github-release"
                          ? "No GitHub release"
                          : library.status === "repo-unresolved"
                            ? "Repository unavailable"
                            : "Not applicable"}
                      </span>
                    )}
                  </td>
                  <td className="numeric stars">
                    {library.stars === null ? "—" : number.format(library.stars)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {libraries.length === 0 && <p className="no-results">No entries match those filters.</p>}

      <footer>
        <p>
          “Latest release” means the newest published GitHub Release, including
          pre-releases. A project can publish packages or tags without creating a
          GitHub Release, so “No GitHub release” is not the same as “never shipped.”
        </p>
        <p>
          Stars are point-in-time counts. Duplicate README links to the same repository
          are shown once. Deleted, renamed, non-GitHub, and built-in projects remain in
          the report with unavailable GitHub fields.
        </p>
      </footer>
    </main>
  );
}
