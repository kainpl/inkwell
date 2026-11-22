"""Collect the exact installable assets from a native Tauri build."""

import argparse
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAURI = ROOT / "src-tauri"
CONFIG = json.loads((TAURI / "tauri.conf.json").read_text(encoding="utf-8"))
VERSION = CONFIG["version"]


def copy_bundle(build, output, kind, extension, name):
    candidates = list((build / "bundle" / kind).glob("*" + extension))
    if len(candidates) != 1:
        raise SystemExit(f"Expected one {extension} in {build / 'bundle' / kind}, found {candidates}")
    shutil.copyfile(candidates[0], output / name)


def stage(platform, output):
    output.mkdir(parents=True, exist_ok=True)
    build = TAURI / "target" / "release"
    base = f"Inkwell-{VERSION}"
    if platform == "windows":
        copy_bundle(build, output, "nsis", ".exe", f"{base}-windows-x64-setup.exe")
        with zipfile.ZipFile(output / f"{base}-windows-x64-portable.zip", "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(build / "inkwell.exe", "Inkwell/Inkwell.exe")
            archive.writestr("Inkwell/portable", "")
            for source, destination in CONFIG["bundle"]["resources"].items():
                archive.write(TAURI / source, f"Inkwell/{destination}")
    elif platform == "linux":
        copy_bundle(build, output, "deb", ".deb", f"{base}-linux-x64.deb")
        copy_bundle(build, output, "appimage", ".AppImage", f"{base}-linux-x64.AppImage")
    else:
        build = TAURI / "target" / "universal-apple-darwin" / "release"
        copy_bundle(build, output, "dmg", ".dmg", f"{base}-macos-universal.dmg")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("platform", choices=("windows", "linux", "macos"))
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    stage(args.platform, args.output)
