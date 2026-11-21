"""Select the same floor plan that the web simulation and marker checks use."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Blender passes its own switches before the '--' script-argument separator.
arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
SMALL = "--small" in arguments
MODEL_NAME = "rauchhaus-klein" if SMALL else "rauchhaus"
plan_file = "layout-small.json" if SMALL else "layout.json"
LAYOUT = json.loads((ROOT / "src/simulation" / plan_file).read_text())
DOORS = [*LAYOUT["doors"]]
if "exteriorDoor" in LAYOUT:
    DOORS.append(LAYOUT["exteriorDoor"])
