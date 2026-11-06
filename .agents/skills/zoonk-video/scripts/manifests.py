"""Collects every captured sequence's manifest into assets/real/manifests.js for K.seq: python3 scripts/manifests.py <work-dir>"""
import json, os, sys
root = sys.argv[1]
out = {}
for lang in ["en", "pt"]:
    out[lang] = {}
    d = os.path.join(root, "assets/real", lang, "seq")
    if not os.path.isdir(d): continue
    for name in sorted(os.listdir(d)):
        m = os.path.join(d, name, "manifest.json")
        if os.path.exists(m):
            out[lang][name] = json.load(open(m))["frames"]
open(os.path.join(root, "assets/real/manifests.js"), "w").write("window.MANIFESTS=" + json.dumps(out) + ";")
print({k: list(v) for k, v in out.items()})
