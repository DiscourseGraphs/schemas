#!/usr/bin/env python3
"""Regenerate data.js from data/*.

Run after re-downloading any of the three source files. data.js is what the
HTML page actually reads, so the page works opened directly via file://.
"""
import json
import pathlib

root = pathlib.Path(__file__).parent / "data"
oxa = json.loads((root / "headley.oxa.json").read_text())
jld = json.loads((root / "headley.dg.jsonld").read_text())
ttl = (root / "claim-relations.ttl").read_text()
assert "`" not in ttl and "${" not in ttl, "TTL contains template-literal-unsafe chars"

out_path = pathlib.Path(__file__).parent / "data.js"
out_path.write_text(
    "// AUTO-GENERATED from data/*. Regenerate via build-data.py.\n"
    f"window.OXA_DATA = {json.dumps(oxa)};\n"
    f"window.JSONLD_DATA = {json.dumps(jld)};\n"
    f"window.TTL_TEXT = `{ttl}`;\n"
)
print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
