"""Read release metadata from shipped packages without executing extension code."""
import hashlib
import io
import json
import re
import zipfile

REPOSITORY = "DIMaslov1904/sup5th"
ADDON_ID = "sup5th@5th.ru"
UPDATE_URL = f"https://raw.githubusercontent.com/{REPOSITORY}/main/updates/firefox.json"
VERSION = r"[0-9]+(?:\.[0-9]+){1,3}"
PACKAGE = re.compile(rf"sup5th-(chrome|opera|firefox)-v({VERSION})\.(zip|xpi)")
MAX_PACKAGE_BYTES = 100 * 1024 * 1024


def version_key(value):
    if not re.fullmatch(VERSION, value):
        raise ValueError(f"Unsupported version: {value}")
    parts = tuple(map(int, value.split(".")))
    if any(part > 65535 for part in parts):
        raise ValueError("Version component exceeds 65535")
    return parts + (0,) * (4 - len(parts))


def inspect_package(asset, content, tag):
    match = PACKAGE.fullmatch(asset["name"])
    if not match:
        raise ValueError(f"Unexpected package name: {asset['name']}")
    browser, version, suffix = match.groups()
    version_key(version)
    if tag != f"v{version}":
        raise ValueError("Package version does not match release tag")
    if browser != "firefox" and suffix != "zip":
        raise ValueError("Chromium packages require ZIP")
    if len(content) > MAX_PACKAGE_BYTES:
        raise ValueError("Package exceeds 100 MiB")
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        if archive.namelist().count("manifest.json") != 1:
            raise ValueError("A single manifest.json must be at the archive root")
        if archive.getinfo("manifest.json").file_size > 1024 * 1024:
            raise ValueError("Manifest exceeds 1 MiB")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("version") != version or manifest.get("manifest_version") != 3:
            raise ValueError("Manifest version does not match package name or MV3")
        gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
        if browser == "firefox":
            if gecko.get("id") != ADDON_ID or gecko.get("update_url") != UPDATE_URL:
                raise ValueError("Firefox ID or update_url does not match distribution")
            names = set(archive.namelist())
            signatures = ({"META-INF/mozilla.rsa", "META-INF/mozilla.sf", "META-INF/manifest.mf"},
                          {"META-INF/cose.sig", "META-INF/cose.manifest"})
            if suffix == "xpi" and not any(group <= names for group in signatures):
                raise ValueError("Firefox XPI has no signature blocks; obtain Mozilla signing")
        elif gecko or "service_worker" not in manifest.get("background", {}):
            raise ValueError("Chromium package contains a Firefox manifest or lacks a service worker")
    expected = f"https://github.com/{REPOSITORY}/releases/download/{tag}/{asset['name']}"
    if asset.get("browser_download_url") != expected:
        raise ValueError("Package download URL does not match release")
    digest = hashlib.sha256(content).hexdigest()
    return {"browser": browser, "version": version, "sha256": digest,
            "signed": browser == "firefox" and suffix == "xpi",
            "download_url": expected,
            "minimum_version": gecko.get("strict_min_version", "140.0") if browser == "firefox"
            else manifest.get("minimum_chrome_version", "130")}


def firefox_document(package):
    entry = {"version": package["version"], "update_link": package["download_url"],
             "update_hash": "sha256:" + package["sha256"],
             "applications": {"gecko": {"strict_min_version": package["minimum_version"]}}}
    return {"addons": {ADDON_ID: {"updates": [entry]}}}


def next_document(current, package):
    if package["browser"] == "firefox" and not package["signed"]:
        raise ValueError("Unsigned Firefox packages cannot enter automatic updates")
    firefox = package["browser"] == "firefox"
    previous = next(iter(current.get("addons", {}).get(ADDON_ID, {}).get("updates", [])), {}) if firefox else current
    if previous.get("version"):
        comparison = version_key(package["version"]) > version_key(previous["version"])
        if not comparison:
            if version_key(package["version"]) == version_key(previous["version"]):
                old_hash = previous.get("update_hash", "").removeprefix("sha256:") if firefox else previous.get("sha256")
                if old_hash != package["sha256"]:
                    raise ValueError("Published version has different contents; increment version")
            return current
    if firefox:
        return firefox_document(package)
    return {"version": package["version"], "download_url": package["download_url"],
            "sha256": package["sha256"], "minimum_chrome_version": package["minimum_version"]}
