"""
Rebuild web/data/bins.json from NEA's open datasets.

    python scripts/fetch-bins.py     # downloads the three GeoJSON files
    python scripts/build-bins.py     # normalises them into web/data/bins.json

Source: data.gov.sg (National Environment Agency), Singapore Open Data Licence.
The committed bins.json is a dated snapshot — the download URLs are signed and
expire, so the app reads the snapshot rather than calling the API at runtime.
"""
import json, re, html, os

OUT = r"C:/Users/ravih/OneDrive/Desktop/LifeHack/NUS_lifehack/web/data"
os.makedirs(OUT, exist_ok=True)

def fields(props):
    """NEA ships half these layers with the real columns buried in an HTML table."""
    if "ADDRESSSTREETNAME" in props:
        return props
    desc = props.get("Description", "") or ""
    out = {}
    for k, v in re.findall(r"<th>(.*?)</th>\s*<td>(.*?)</td>", desc, re.S):
        out[html.unescape(k.strip())] = html.unescape(re.sub("<[^>]+>", "", v)).strip()
    return out

def label(f):
    blk = (f.get("ADDRESSBLOCKHOUSENUMBER") or "").strip()
    st = (f.get("ADDRESSSTREETNAME") or "").strip().title()
    bld = (f.get("ADDRESSBUILDINGNAME") or "").strip().title()
    if bld and bld.lower() not in ("nil", "na"):
        return bld
    if blk and st:
        return f"Blk {blk} {st}"
    return st or (f.get("NAME") or "Recycling point").strip()

rows, seen = [], set()
SOURCES = [
    ("sg_recycling.geojson", "recycling", ["plastic", "paper", "metal", "glass"]),
    ("sg_ewaste.geojson", "ewaste", ["e-waste"]),
]

for path, kind, streams in SOURCES:
    data = json.load(open(path, encoding="utf-8"))
    for feat in data.get("features", []):
        g = feat.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        coords = g.get("coordinates") or []
        if len(coords) < 2:
            continue
        lng, lat = round(float(coords[0]), 5), round(float(coords[1]), 5)
        # Singapore bounding box — drop anything that isn't plausibly here.
        if not (1.15 <= lat <= 1.48 and 103.6 <= lng <= 104.1):
            continue
        p = fields(feat.get("properties", {}))
        key = (kind, lat, lng)
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "n": label(p),
            "p": (p.get("ADDRESSPOSTALCODE") or "").strip(),
            "t": kind,
            "s": streams,
            "y": lat,
            "x": lng,
        })

by = {}
for r in rows:
    by[r["t"]] = by.get(r["t"], 0) + 1
print("kept:", len(rows), by)

dest = os.path.join(OUT, "bins.json")
with open(dest, "w", encoding="utf-8") as fh:
    json.dump(rows, fh, separators=(",", ":"), ensure_ascii=False)
print("wrote", dest, os.path.getsize(dest) // 1024, "KB")
