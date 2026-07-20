import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
README_URL = "https://github.com/wilsonfreitas/awesome-quant/blob/main/README.md"
LANGUAGE_ALIASES = {"CPP": "C++", "CSharp": "C#"}


def gh(*args: str) -> str:
    result = subprocess.run(
        ["gh", *args], capture_output=True, text=True, encoding="utf-8"
    )
    if result.returncode and not result.stdout.lstrip().startswith("{"):
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout


def repo_slug(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.netloc.lower().endswith(".github.io"):
        owner = parsed.netloc[: -len(".github.io")]
        repo = parsed.path.strip("/").split("/", 1)[0]
        return f"{owner}/{repo}" if owner and repo else None
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None
    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2 or parts[1] in {"topics", "search", "marketplace"}:
        return None
    return f"{parts[0]}/{parts[1].removesuffix('.git')}"


def extract_libraries(markdown: str) -> list[dict]:
    section = ""
    rows = []
    link_re = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
    languages_re = re.compile(r"\s+-\s+((?:`[^`]+`\s*)+)\s+-\s+")
    for line in markdown.splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        if not re.match(r"\s*[-*] ", line):
            continue
        links = link_re.findall(line)
        languages_match = languages_re.search(line)
        if not links or not languages_match:
            continue
        languages = [
            LANGUAGE_ALIASES.get(language, language)
            for language in re.findall(r"`([^`]+)`", languages_match.group(1))
        ]
        name, primary_url = links[0]
        github_links = [url for _, url in links if repo_slug(url)]
        repo = repo_slug(github_links[0]) if github_links else None
        description = re.sub(r"^\s*[-*]\s*", "", line)
        description = re.sub(r"\[[^\]]+\]\([^)]+\)", "", description)
        description = languages_re.sub(" — ", description, count=1)
        rows.append(
            {
                "name": name,
                "section": section,
                "languages": languages,
                "primary_url": primary_url,
                "repo_requested": repo,
                "description": description.strip(),
            }
        )
    unique = []
    seen = set()
    for row in rows:
        key = row["repo_requested"] or (row["name"], row["primary_url"])
        if key not in seen:
            unique.append(row)
            seen.add(key)
    return unique


def fetch_repositories(slugs: list[str]) -> dict[str, dict | None]:
    repositories: dict[str, dict | None] = {}
    for start in range(0, len(slugs), 35):
        batch = slugs[start : start + 35]
        fields = []
        for index, slug in enumerate(batch):
            owner, name = slug.split("/", 1)
            fields.append(
                f'''r{index}: repository(owner: {json.dumps(owner)}, name: {json.dumps(name)}) {{
                  nameWithOwner url stargazerCount isArchived
                  releases(first: 1, orderBy: {{field: CREATED_AT, direction: DESC}}) {{
                    nodes {{ tagName publishedAt createdAt isPrerelease url }}
                  }}
                }}'''
            )
        response = json.loads(gh("api", "graphql", "-f", f"query=query {{\n{chr(10).join(fields)}\n}}"))
        if response.get("errors") and not response.get("data"):
            raise RuntimeError(json.dumps(response["errors"]))
        for index, slug in enumerate(batch):
            repositories[slug] = response["data"].get(f"r{index}")
    return repositories


def check_url(url: str) -> tuple[str, int | str]:
    try:
        request = Request(url, method="HEAD", headers={"User-Agent": "aq-lib-pulse-refresh"})
        with urlopen(request, timeout=20) as response:
            return url, response.status
    except Exception as head_error:
        try:
            request = Request(url, headers={"Range": "bytes=0-0", "User-Agent": "aq-lib-pulse-refresh"})
            with urlopen(request, timeout=20) as response:
                return url, response.status
        except Exception as get_error:
            return url, f"{type(get_error).__name__}: {get_error}" if get_error else str(head_error)


def validate_links(libraries: list[dict]) -> dict:
    urls = sorted({row["primary_url"] for row in libraries} | {row["repo_url"] for row in libraries if row.get("repo_url")})
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = dict(pool.map(check_url, urls))
    failures = {url: status for url, status in results.items() if not isinstance(status, int) or status >= 400}
    return {"checked": len(urls), "failed": failures}


def main() -> None:
    markdown = gh(
        "api",
        "repos/wilsonfreitas/awesome-quant/contents/README.md",
        "-H",
        "Accept: application/vnd.github.raw+json",
    )
    libraries = extract_libraries(markdown)
    slugs = sorted({row["repo_requested"] for row in libraries if row["repo_requested"]})
    repositories = fetch_repositories(slugs)
    for row in libraries:
        repo = repositories.get(row["repo_requested"])
        if not repo:
            row.update(repo=None, repo_url=None, stars=None, archived=None, release=None, status="no-github-repo" if not row["repo_requested"] else "repo-unresolved")
            continue
        release = repo["releases"]["nodes"][0] if repo["releases"]["nodes"] else None
        row.update(repo=repo["nameWithOwner"], repo_url=repo["url"], stars=repo["stargazerCount"], archived=repo["isArchived"], release=release, status="released" if release else "no-github-release")

    links = validate_links(libraries)
    payload = {
        "as_of": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": README_URL,
        "method": "GitHub GraphQL repository stars and newest published GitHub Release, including prereleases; HEAD/GET validation of primary and repository links.",
        "link_validation": links,
        "libraries": libraries,
    }
    with (ROOT / "app" / "libraries.json").open("w", encoding="utf-8", newline="\n") as output:
        json.dump(payload, output, indent=2, ensure_ascii=False)
        output.write("\n")

    crypto_path = ROOT / "app" / "crypto-only.json"
    crypto_repos = json.loads(crypto_path.read_text(encoding="utf-8"))
    current_repos = {row["repo"] for row in libraries if row.get("repo")}
    with crypto_path.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(sorted(set(crypto_repos) & current_repos), output, indent=2)
        output.write("\n")
    print(json.dumps({"entries": len(libraries), "unique_repositories": len(slugs), "link_validation": links, "crypto_only": len(set(crypto_repos) & current_repos)}, indent=2))


if __name__ == "__main__":
    main()
