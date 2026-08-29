import os
from pathlib import Path
import shutil
import sys

try:
    import urllib.request as request
except ImportError:
    request = None


def download(url: str, destination: Path) -> None:
    if request is None:
        raise RuntimeError("urllib not available to download assets.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url} -> {destination}")
    with request.urlopen(url) as response, destination.open("wb") as out_file:
        shutil.copyfileobj(response, out_file)


def main() -> None:
    base = Path("static/vendor/leaflet")
    files = [
        ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", base / "leaflet.js"),
        ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", base / "leaflet.css"),
        ("https://unpkg.com/leaflet.fullscreen@1.6.0/Control.FullScreen.js", base / "leaflet.fullscreen.js"),
        ("https://unpkg.com/leaflet.fullscreen@1.6.0/Control.FullScreen.css", base / "leaflet.fullscreen.css"),
        ("https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js", base / "leaflet.markercluster.js"),
        ("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css", base / "MarkerCluster.css"),
        ("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css", base / "MarkerCluster.Default.css"),
        ("https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js", base / "leaflet-heat.js"),
        ("https://cdnjs.cloudflare.com/ajax/libs/leaflet-beautify-marker-icon/1.0.7/leaflet-beautify-marker-icon.min.js",
         base / "leaflet-beautify-marker-icon.js"),
        ("https://cdnjs.cloudflare.com/ajax/libs/leaflet-beautify-marker-icon/1.0.7/leaflet-beautify-marker-icon.min.css",
         base / "leaflet-beautify-marker-icon.css"),
    ]

    for url, dest in files:
        download(url, dest)

    print("All Leaflet assets downloaded locally.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Failed to setup local Leaflet assets: {exc}", file=sys.stderr)
        sys.exit(1)
