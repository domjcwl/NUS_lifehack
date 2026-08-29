"""
Download NEA's bin datasets from data.gov.sg.

Run from the repo root, then run build-bins.py to normalise the output.
Dataset IDs come from the collection metadata endpoint:
    https://api-production.data.gov.sg/v2/public/api/collections/{id}/metadata
"""

import json
import urllib.request

DATASETS = {
    # collection 1450 — Recycling Bins (NEA)
    "sg_recycling": "d_4dde14826642f49eefff48b7832b90db",
    # collection 1443 — E-waste Recycling (NEA)
    "sg_ewaste": "d_db40d004afeb5a7f0f555fdcc34934cc",
}

POLL = "https://api-open.data.gov.sg/v1/public/api/datasets/{}/poll-download"

for name, dataset_id in DATASETS.items():
    with urllib.request.urlopen(POLL.format(dataset_id)) as resp:
        url = json.load(resp)["data"]["url"]
    with urllib.request.urlopen(url) as src, open(f"{name}.geojson", "wb") as dst:
        payload = src.read()
        dst.write(payload)
    print(f"{name}: {len(payload) // 1024} KB")
