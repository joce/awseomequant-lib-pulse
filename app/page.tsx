"use client";

import { useMemo, useState } from "react";
import cryptoOnly from "./crypto-only.json";
import data from "./libraries.json";

type Library = (typeof data.libraries)[number];
type SortKey = "name" | "section" | "languages" | "release" | "stars";

const date = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const number = new Intl.NumberFormat("en");
const cryptoOnlyRepositories = new Set(cryptoOnly);

function isCryptoOnly(library: Library) {
  return library.repo !== null && cryptoOnlyRepositories.has(library.repo);
}

function releaseLabel(library: Library) {
  if (library.release?.publishedAt) return "released";
  if (library.status === "no-github-release") return "none";
  return "unavailable";
}

function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [market, setMarket] = useState("all");
  const [archive, setArchive] = useState("all");
  const [release, setRelease] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "stars",
    direction: "desc",
  });

  const availableSections = useMemo(
    () => [...new Set(data.libraries.map((library) => library.section))].sort(),
    [],
  );
  const availableLanguages = useMemo(
    () =>
      [...new Set(data.libraries.flatMap((library) => library.languages))].sort(),
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
          (!sections.length || sections.includes(library.section)) &&
          (!languages.length ||
            library.languages.some((language) => languages.includes(language))) &&
          (market === "all" ||
            (market === "exclude"
              ? !isCryptoOnly(library)
              : isCryptoOnly(library))) &&
          (archive === "all" ||
            (archive === "exclude" ? !library.archived : library.archived)) &&
          (release === "all" || releaseLabel(library) === release),
      )
      .sort((a, b) => {
        const direction = sort.direction === "asc" ? 1 : -1;
        if (sort.key === "stars")
          return ((a.stars ?? -1) - (b.stars ?? -1)) * direction;
        if (sort.key === "release")
          return (a.release?.publishedAt ?? "").localeCompare(
            b.release?.publishedAt ?? "",
          ) * direction;
        if (sort.key === "languages")
          return a.languages.join(", ").localeCompare(b.languages.join(", ")) * direction;
        return a[sort.key].localeCompare(b[sort.key]) * direction;
      });
  }, [query, sections, languages, market, archive, release, sort]);

  function sortBy(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : {
            key,
            direction: key === "name" || key === "section" || key === "languages"
              ? "asc"
              : "desc",
          },
    );
  }

  function sortHeader(key: SortKey, label: string, className?: string) {
    const active = sort.key === key;
    return (
      <th
        className={className}
        aria-sort={
          active
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <button type="button" className="sort-button" onClick={() => sortBy(key)}>
          {label} <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
        </button>
      </th>
    );
  }

  const released = data.libraries.filter((library) => library.release).length;
  const noRelease = data.libraries.filter(
    (library) => library.status === "no-github-release",
  ).length;

  return (
    <main>
      <header className="hero">
        <div>
          <h1>Awesome Quant · Library pulse</h1>
          <p className="lede">
            Every language-tagged entry in the current{" "}
            <a href={data.source} target="_blank" rel="noreferrer">
              Awesome Quant README
            </a>
            ,
            checked against GitHub on 16 July 2026.
          </p>
        </div>
        <a className="source" href={data.source} target="_blank" rel="noreferrer">
          View source list ↗
        </a>
      </header>

      <section className="summary" aria-label="Dataset summary">
        <div><strong>{number.format(data.libraries.length)}</strong><span>Libraries</span></div>
        <div><strong>{number.format(released)}</strong><span>With a GitHub release</span></div>
        <div><strong>{number.format(noRelease)}</strong><span>Without a GitHub release</span></div>
        <div><strong>{number.format(cryptoOnly.length)}</strong><span>Crypto-only</span></div>
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
        <details className="multi-filter">
          <summary>Languages <span>{languages.length ? `${languages.length} selected` : "All"}</span></summary>
          <fieldset>
            <legend>Filter by one or more languages</legend>
            {availableLanguages.map((value) => (
              <label className="check" key={value}>
                <input
                  type="checkbox"
                  checked={languages.includes(value)}
                  onChange={() => setLanguages((current) => toggle(current, value))}
                />
                <span>{value}</span>
              </label>
            ))}
          </fieldset>
        </details>
        <details className="multi-filter">
          <summary>Categories <span>{sections.length ? `${sections.length} selected` : "All"}</span></summary>
          <fieldset>
            <legend>Filter by one or more categories</legend>
            {availableSections.map((value) => (
              <label className="check" key={value}>
                <input
                  type="checkbox"
                  checked={sections.includes(value)}
                  onChange={() => setSections((current) => toggle(current, value))}
                />
                <span>{value}</span>
              </label>
            ))}
          </fieldset>
        </details>
        <label>
          <span>Market scope</span>
          <select value={market} onChange={(event) => setMarket(event.target.value)}>
            <option value="all">All markets</option>
            <option value="exclude">Hide crypto-only</option>
            <option value="only">Crypto-only</option>
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
          <span>Project status</span>
          <select value={archive} onChange={(event) => setArchive(event.target.value)}>
            <option value="all">All projects</option>
            <option value="exclude">Hide archived</option>
            <option value="only">Archived only</option>
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
              {sortHeader("name", "Library")}
              {sortHeader("languages", "Languages")}
              {sortHeader("section", "Category")}
              {sortHeader("release", "Latest GitHub release")}
              {sortHeader("stars", "Stars", "numeric")}
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
                    {isCryptoOnly(library) && <span className="status-tag">Crypto-only</span>}
                    {library.archived && <span className="status-tag archive-tag">Archived</span>}
                    <span className="repo">
                      {library.repo ?? "No GitHub repository"}
                    </span>
                  </td>
                  <td><span className="languages">{library.languages.join(", ")}</span></td>
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
        <p>
          Crypto-only flags are conservative: a project is marked only when its stated
          scope is exclusively cryptocurrency, digital assets, blockchain, or DeFi.
          Mixed-market tools are not flagged.
        </p>
      </footer>
    </main>
  );
}
