"""Publish only metadata and checksums for an existing public GitHub release."""
import base64
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

from release_metadata import MAX_PACKAGE_BYTES, REPOSITORY, VERSION, inspect_package, next_document


def api(path, method="GET", payload=None, binary=False):
    # Send the workflow token only to the fixed GitHub API/upload origins.
    origin = "https://uploads.github.com" if binary else "https://api.github.com"
    body = payload if binary else (json.dumps(payload).encode() if payload is not None else None)
    request = urllib.request.Request(origin + path, data=body, method=method, headers={
        "Authorization": "Bearer " + os.environ["GH_TOKEN"],
        "Accept": "application/vnd.github+json", "User-Agent": "sup5th-release-metadata",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "text/plain" if binary else "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        content = response.read()
        return json.loads(content) if content else None


def read_document(path):
    remote = api(f"/repos/{REPOSITORY}/contents/{path}?ref=main")
    return json.loads(base64.b64decode(remote["content"])), remote["sha"]


def main():
    if os.environ.get("GH_REPOSITORY") != REPOSITORY:
        raise ValueError("Unexpected distribution repository")
    tag = os.environ.get("RELEASE_TAG", "")
    if not re.fullmatch("v" + VERSION, tag):
        raise ValueError("Release tag must be v followed by a numeric extension version")
    release = api(f"/repos/{REPOSITORY}/releases/tags/{urllib.parse.quote(tag, safe='')}")
    if release["draft"] or release["prerelease"]:
        print("Draft/pre-release: stable update metadata unchanged")
        return
    packages = []
    for asset in release["assets"]:
        if asset["name"] == "SHA256SUMS.txt":
            continue
        # Public download uses no Authorization header, including across redirects.
        expected = f"https://github.com/{REPOSITORY}/releases/download/{tag}/{asset['name']}"
        if asset["browser_download_url"] != expected:
            raise ValueError("Unexpected asset download origin or path")
        if asset["size"] > MAX_PACKAGE_BYTES:
            raise ValueError("Package exceeds 100 MiB")
        with urllib.request.urlopen(expected, timeout=60) as response:
            content = response.read(MAX_PACKAGE_BYTES + 1)
        package = inspect_package(asset, content, tag)
        identity = (package["browser"], package["signed"])
        if any((item[1]["browser"], item[1]["signed"]) == identity for item in packages):
            raise ValueError("Duplicate browser package in release")
        packages.append((asset, package))
    if not packages:
        raise ValueError("Attach a Chrome/Opera ZIP, Firefox build ZIP or signed Firefox XPI")

    # Validate every package and version transition before writing anything.
    changes = []
    for asset, package in packages:
        if package["browser"] == "firefox" and not package["signed"]:
            continue
        path = f"updates/{package['browser']}.json"
        current, sha = read_document(path)
        updated = next_document(current, package)
        if updated != current:
            changes.append((path, sha, updated))

    checksums = "".join(f"{package['sha256']}  {asset['name']}\n" for asset, package in sorted(packages, key=lambda item: item[0]["name"])).encode()
    existing = next((asset for asset in release["assets"] if asset["name"] == "SHA256SUMS.txt"), None)
    if existing:
        api(f"/repos/{REPOSITORY}/releases/assets/{existing['id']}", method="DELETE")
    api(f"/repos/{REPOSITORY}/releases/{release['id']}/assets?name=SHA256SUMS.txt", method="POST", payload=checksums, binary=True)
    for path, sha, document in changes:
        content = (json.dumps(document, ensure_ascii=False, indent=2) + "\n").encode()
        api(f"/repos/{REPOSITORY}/contents/{path}", method="PUT", payload={
            "message": f"Update {path} for {tag}", "sha": sha, "branch": "main",
            "content": base64.b64encode(content).decode()})
        print(f"Updated {path} from {tag}")
    print(f"Validated {len(packages)} package(s); SHA256SUMS.txt uploaded")


if __name__ == "__main__":
    main()
