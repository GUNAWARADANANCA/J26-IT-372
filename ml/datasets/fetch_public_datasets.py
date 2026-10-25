"""Download every public dataset used by the Smart Registered Mail component.

Usage (from the repository root):

    ml/.venv/Scripts/python ml/datasets/fetch_public_datasets.py          # all sources
    ml/.venv/Scripts/python ml/datasets/fetch_public_datasets.py --only fonts osm

Every file lands under ``Datasets/raw/<source>/`` and is recorded in
``Datasets/raw/MANIFEST.json`` together with its source URL, licence, SHA-256
and retrieval time so that the provenance of each training example can be
traced (see Datasets/README.md).

The script is idempotent: files that already exist are skipped unless
``--force`` is given. Network services such as Overpass and Wikidata are rate
limited and occasionally return HTTP 504; the script retries with back-off and
continues with the remaining sources if one fails.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.paths import RAW, ensure  # noqa: E402

USER_AGENT = "PostAssistLK-research/0.1 (SLIIT J26-IT-372 academic project)"

# Sri Lanka bounding box (south, west, north, east) used for Overpass queries.
LK_BBOX = "5.85,79.45,9.9,81.95"

GITHUB_RAW = "https://raw.githubusercontent.com"
GOOGLE_FONTS = f"{GITHUB_RAW}/google/fonts/main/ofl"

SOURCES: dict[str, dict] = {
    "gazetteer": {
        "licence": "MIT",
        "citation": "M. Madurapperuma, sri-lanka-provinces-districts-cities (GitHub)",
        "files": {
            "gazetteer_madurapa/cities.sql": f"{GITHUB_RAW}/madurapa/sri-lanka-provinces-districts-cities/master/cities.sql",
            "gazetteer_madurapa/districts.sql": f"{GITHUB_RAW}/madurapa/sri-lanka-provinces-districts-cities/master/districts.sql",
            "gazetteer_madurapa/provinces.sql": f"{GITHUB_RAW}/madurapa/sri-lanka-provinces-districts-cities/master/provinces.sql",
            "gazetteer_madurapa/LICENSE": f"{GITHUB_RAW}/madurapa/sri-lanka-provinces-districts-cities/master/LICENSE",
        },
    },
    "deepparse": {
        "licence": "CC BY 4.0",
        "citation": "M. Yassine and D. Beauchemin, Structured Multinational Address Data (deepparse/worldwide-addresses)",
        "files": {
            # Sri Lanka split: ~19k OpenStreetMap/libpostal-derived addresses (English + Sinhala).
            "deepparse_worldwide/lk.parquet": "https://huggingface.co/datasets/deepparse/worldwide-addresses/resolve/main/lk/chunk-0.parquet",
        },
    },
    "tariff": {
        "licence": "Public government notice (Department of Posts, Sri Lanka)",
        "citation": "Department of Posts Sri Lanka, Domestic postage revision effective 9 February 2026",
        "files": {
            "slpost/domestic_postage_revision_2026-02-09.pdf": "https://slpost.gov.lk/wp-content/uploads/2026/02/domesticpostagerevision2026-02-09.pdf",
        },
    },
    "fonts": {
        "licence": "SIL Open Font License 1.1",
        "citation": "Google Fonts (github.com/google/fonts)",
        "files": {
            # --- Sinhala -------------------------------------------------------
            "fonts/NotoSansSinhala.ttf": f"{GOOGLE_FONTS}/notosanssinhala/NotoSansSinhala%5Bwdth,wght%5D.ttf",
            "fonts/NotoSerifSinhala.ttf": f"{GOOGLE_FONTS}/notoserifsinhala/NotoSerifSinhala%5Bwdth,wght%5D.ttf",
            "fonts/AbhayaLibre-Regular.ttf": f"{GOOGLE_FONTS}/abhayalibre/AbhayaLibre-Regular.ttf",
            "fonts/AbhayaLibre-Bold.ttf": f"{GOOGLE_FONTS}/abhayalibre/AbhayaLibre-Bold.ttf",
            "fonts/Yaldevi.ttf": f"{GOOGLE_FONTS}/yaldevi/Yaldevi%5Bwght%5D.ttf",
            "fonts/GemunuLibre.ttf": f"{GOOGLE_FONTS}/gemunulibre/GemunuLibre%5Bwght%5D.ttf",
            "fonts/StickNoBills.ttf": f"{GOOGLE_FONTS}/sticknobills/StickNoBills%5Bwght%5D.ttf",
            "fonts/OFL-NotoSansSinhala.txt": f"{GOOGLE_FONTS}/notosanssinhala/OFL.txt",
            # --- Tamil ---------------------------------------------------------
            "fonts/NotoSansTamil.ttf": f"{GOOGLE_FONTS}/notosanstamil/NotoSansTamil%5Bwdth,wght%5D.ttf",
            "fonts/NotoSerifTamil.ttf": f"{GOOGLE_FONTS}/notoseriftamil/NotoSerifTamil%5Bwdth,wght%5D.ttf",
            "fonts/HindMadurai-Regular.ttf": f"{GOOGLE_FONTS}/hindmadurai/HindMadurai-Regular.ttf",
            "fonts/MuktaMalar-Regular.ttf": f"{GOOGLE_FONTS}/muktamalar/MuktaMalar-Regular.ttf",
            "fonts/Catamaran.ttf": f"{GOOGLE_FONTS}/catamaran/Catamaran%5Bwght%5D.ttf",
            "fonts/Kavivanar-Regular.ttf": f"{GOOGLE_FONTS}/kavivanar/Kavivanar-Regular.ttf",
            "fonts/Pavanam-Regular.ttf": f"{GOOGLE_FONTS}/pavanam/Pavanam-Regular.ttf",
            "fonts/MeeraInimai-Regular.ttf": f"{GOOGLE_FONTS}/meerainimai/MeeraInimai-Regular.ttf",
            "fonts/BalooThambi2.ttf": f"{GOOGLE_FONTS}/baloothambi2/BalooThambi2%5Bwght%5D.ttf",
            "fonts/TiroTamil-Regular.ttf": f"{GOOGLE_FONTS}/tirotamil/TiroTamil-Regular.ttf",
            # --- Latin (printed and handwriting-style) -------------------------
            "fonts/NotoSans.ttf": f"{GOOGLE_FONTS}/notosans/NotoSans%5Bwdth,wght%5D.ttf",
            "fonts/NotoSerif.ttf": f"{GOOGLE_FONTS}/notoserif/NotoSerif%5Bwdth,wght%5D.ttf",
            "fonts/SourceSans3.ttf": f"{GOOGLE_FONTS}/sourcesans3/SourceSans3%5Bwght%5D.ttf",
            "fonts/Merriweather.ttf": f"{GOOGLE_FONTS}/merriweather/Merriweather%5Bopsz,wdth,wght%5D.ttf",
            "fonts/CourierPrime-Regular.ttf": f"{GOOGLE_FONTS}/courierprime/CourierPrime-Regular.ttf",
            "fonts/Caveat.ttf": f"{GOOGLE_FONTS}/caveat/Caveat%5Bwght%5D.ttf",
            "fonts/Kalam-Regular.ttf": f"{GOOGLE_FONTS}/kalam/Kalam-Regular.ttf",
            "fonts/IndieFlower-Regular.ttf": f"{GOOGLE_FONTS}/indieflower/IndieFlower-Regular.ttf",
            "fonts/PatrickHand-Regular.ttf": f"{GOOGLE_FONTS}/patrickhand/PatrickHand-Regular.ttf",
            "fonts/ShadowsIntoLight.ttf": f"{GOOGLE_FONTS}/shadowsintolight/ShadowsIntoLight.ttf",
        },
    },
}

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]

OVERPASS_QUERIES = {
    # Post offices: candidate reference points for facility-consistency checks.
    "osm/post_offices.json": (
        f'[out:json][timeout:300];(node["amenity"="post_office"]({LK_BBOX});'
        f'way["amenity"="post_office"]({LK_BBOX}););out center tags;'
    ),
    # Streets that carry Sinhala and/or Tamil names: vocabulary for the address
    # tagger and text lines for the script-identification renderer.
    "osm/streets_si_ta.json": (
        f'[out:json][timeout:300];(way["highway"]["name:si"]({LK_BBOX});'
        f'way["highway"]["name:ta"]({LK_BBOX}););out tags;'
    ),
}

OSM_LICENCE = "ODbL 1.0 (OpenStreetMap contributors)"
OSM_CITATION = "OpenStreetMap contributors, via the Overpass API"

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
WIKIDATA_LICENCE = "CC0 1.0"
WIKIDATA_CITATION = "Wikidata given-name (P735) and family-name (P734) labels of Sri Lankan citizens"

WIKIDATA_QUERY = """
SELECT ?name ?lang ?kind WHERE {
  VALUES ?kind { "given" "family" }
  { ?p wdt:P27 wd:Q854; wdt:P31 wd:Q5; wdt:P735 ?n. BIND("given" AS ?k) }
  UNION
  { ?p wdt:P27 wd:Q854; wdt:P31 wd:Q5; wdt:P734 ?n. BIND("family" AS ?k) }
  FILTER(?k = ?kind)
  ?n rdfs:label ?name. BIND(LANG(?name) AS ?lang) FILTER(?lang IN ("en","si","ta"))
}
"""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_get(url: str, *, data: bytes | None = None, headers: dict | None = None,
             timeout: int = 120, attempts: int = 4) -> bytes:
    last_err: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001 - network errors are retried
            last_err = exc
            wait = 5 * attempt
            print(f"    attempt {attempt} failed ({exc}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError(f"download failed after {attempts} attempts: {url}") from last_err


def record(manifest: dict, rel: str, url: str, licence: str, citation: str) -> None:
    path = RAW / rel
    manifest[rel] = {
        "url": url,
        "licence": licence,
        "citation": citation,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def fetch_static(name: str, manifest: dict, force: bool) -> None:
    spec = SOURCES[name]
    for rel, url in spec["files"].items():
        dest = RAW / rel
        if dest.exists() and not force:
            print(f"  skip  {rel} (exists)")
            if rel not in manifest:
                record(manifest, rel, url, spec["licence"], spec["citation"])
            continue
        ensure(dest.parent)
        print(f"  get   {rel}")
        dest.write_bytes(http_get(url))
        record(manifest, rel, url, spec["licence"], spec["citation"])


def fetch_osm(manifest: dict, force: bool) -> None:
    for rel, query in OVERPASS_QUERIES.items():
        dest = RAW / rel
        if dest.exists() and not force:
            print(f"  skip  {rel} (exists)")
            if rel not in manifest:
                record(manifest, rel, OVERPASS_ENDPOINTS[0], OSM_LICENCE, OSM_CITATION)
            continue
        ensure(dest.parent)
        body = urllib.parse.urlencode({"data": query}).encode()
        payload = None
        for endpoint in OVERPASS_ENDPOINTS:
            print(f"  get   {rel} via {endpoint}")
            try:
                payload = http_get(endpoint, data=body, timeout=330, attempts=2)
                json.loads(payload)  # Overpass sometimes returns an HTML error page
                break
            except Exception as exc:  # noqa: BLE001
                print(f"    endpoint failed: {exc}")
                payload = None
        if payload is None:
            print(f"  FAILED {rel}: all Overpass endpoints unavailable, try again later")
            continue
        dest.write_bytes(payload)
        record(manifest, rel, OVERPASS_ENDPOINTS[0], OSM_LICENCE, OSM_CITATION)


def fetch_wikidata(manifest: dict, force: bool) -> None:
    rel = "wikidata/sri_lankan_person_names.csv"
    dest = RAW / rel
    if dest.exists() and not force:
        print(f"  skip  {rel} (exists)")
        if rel not in manifest:
            record(manifest, rel, WIKIDATA_ENDPOINT, WIKIDATA_LICENCE, WIKIDATA_CITATION)
        return
    ensure(dest.parent)
    url = WIKIDATA_ENDPOINT + "?" + urllib.parse.urlencode({"query": WIKIDATA_QUERY})
    print(f"  get   {rel}")
    try:
        dest.write_bytes(http_get(url, headers={"Accept": "text/csv"}, timeout=200, attempts=3))
    except RuntimeError as exc:
        print(f"  FAILED {rel}: {exc}")
        return
    record(manifest, rel, WIKIDATA_ENDPOINT, WIKIDATA_LICENCE, WIKIDATA_CITATION)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="*", choices=[*SOURCES, "osm", "wikidata"],
                        help="limit to these sources")
    parser.add_argument("--force", action="store_true", help="re-download files that already exist")
    args = parser.parse_args()

    ensure(RAW)
    manifest_path = RAW / "MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    wanted = args.only or [*SOURCES, "osm", "wikidata"]

    for name in wanted:
        print(f"[{name}]")
        try:
            if name == "osm":
                fetch_osm(manifest, args.force)
            elif name == "wikidata":
                fetch_wikidata(manifest, args.force)
            else:
                fetch_static(name, manifest, args.force)
        except Exception as exc:  # noqa: BLE001 - keep going with other sources
            print(f"  FAILED {name}: {exc}")
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nManifest written to {manifest_path}")


if __name__ == "__main__":
    main()
