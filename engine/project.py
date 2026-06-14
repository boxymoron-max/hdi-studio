"""
HDI Studio — Project State Management

.hdi project directory format:
  my-project.hdi/
    project.json     — manifest (script, voiceover path, scene plan, decisions)
    audio/           — copied voiceover track
    clips/           — generated/downloaded footage per segment
    output/          — merged MP4

project.json schema:
{
  "version": 1,
  "narration_script": "... full script text ...",
  "voiceover_path": "audio/voiceover.mp3",
  "segments": [
    {
      "id": 0,
      "text": "Imagine your garden.",
      "start_ms": 0,
      "end_ms": 2300,
      "source": "pexels",           // "pexels" or "hyperframe"
      "source_assigned": "pexels",  // original auto-assignment
      "pexels_query": "beautiful garden backyard",
      "pexels_candidates": ["clips/seg0_cand0.mp4", ...],
      "selected_clip": "clips/seg0.mp4",
      "clip_start_ms": 0,           // trim in-point within clip
      "transition": "cut",          // "cut" or "crossfade"
      "hyperframe_html": null,      // for hyperframe segments
      "history": []                 // previous generation attempts
    }
  ],
  "brand": {
    "inferred_style": "... agent inference ..."
  }
}
"""

import json
import os
import shutil
from pathlib import Path
from typing import Optional


def create_project(project_dir: str, script: str, voiceover_path: str) -> dict:
    """Create a new .hdi project directory."""
    proj = Path(project_dir)
    if not proj.suffix == ".hdi":
        proj = proj.with_suffix(".hdi")

    proj.mkdir(parents=True, exist_ok=True)
    (proj / "audio").mkdir(exist_ok=True)
    (proj / "clips").mkdir(exist_ok=True)
    (proj / "output").mkdir(exist_ok=True)

    # Copy voiceover into project
    vo_src = Path(voiceover_path)
    vo_dst = proj / "audio" / vo_src.name
    if vo_src.exists() and not vo_dst.exists():
        shutil.copy2(vo_src, vo_dst)

    manifest = {
        "version": 1,
        "narration_script": script,
        "voiceover_path": str(vo_dst.relative_to(proj)),
        "segments": [],
        "brand": {"inferred_style": ""}
    }
    save_project(proj, manifest)
    return manifest


def load_project(project_dir: str) -> dict:
    """Load a project manifest from a .hdi directory."""
    proj = Path(project_dir)
    manifest_path = proj / "project.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"No project.json in {project_dir}")
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_project(project_dir, manifest: dict) -> None:
    """Save the project manifest."""
    proj = Path(project_dir)
    manifest_path = proj / "project.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def get_clip_dir(project_dir) -> Path:
    """Get the clips directory for a project."""
    return Path(project_dir) / "clips"


def get_output_dir(project_dir) -> Path:
    """Get the output directory for a project."""
    return Path(project_dir) / "output"
