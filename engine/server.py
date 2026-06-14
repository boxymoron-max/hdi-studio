"""
HDI Studio — API Server

Single Python backend that handles all studio operations.
Called by Next.js API routes via subprocess.
"""

import json
import os
import sys
import argparse

# Ensure engine is importable
ENGINE_PATH = os.path.expanduser("~/Desktop/hdi-studio")
if ENGINE_PATH not in sys.path:
    sys.path.insert(0, ENGINE_PATH)

from engine.project import create_project, load_project, save_project
from engine.planner import plan_scenes
from engine.pexels import search_videos, download_clip
from engine.merge import merge_hard_cuts


def cmd_create_project(args):
    """Create a new .hdi project directory."""
    manifest = create_project(args.project_dir, args.script, args.audio_path)
    print(json.dumps({"success": True, "project_dir": os.path.abspath(args.project_dir)}))


def cmd_plan_scenes(args):
    """Run scene planning."""
    plan = plan_scenes(args.script, args.audio_path)

    if args.project_dir:
        manifest = load_project(args.project_dir)
        manifest["segments"] = plan["segments"]
        save_project(args.project_dir, manifest)

    print(json.dumps({
        "success": True,
        "segments": plan["segments"],
        "stats": plan["stats"],
        "project_dir": os.path.abspath(args.project_dir) if args.project_dir else None,
    }))


def cmd_generate(args):
    """Generate footage for all segments."""
    manifest = load_project(args.project_dir)
    segments = manifest.get("segments", [])
    script_context = manifest.get("narration_script", "")

    results = []
    for seg in segments:
        source = seg.get("source", "pexels")
        try:
            if source == "pexels":
                query = seg.get("pexels_query", seg.get("text", ""))
                duration = seg.get("duration_sec", 5)
                candidates_res = search_videos(query, per_page=5, min_duration=duration)

                if not candidates_res:
                    seg["source"] = "hyperframe"
                    seg["selected_clip"] = None
                    results.append({
                        "id": seg["id"], "text": seg.get("text", ""),
                        "source": "hyperframe", "selected_clip": None,
                        "error": "No stock footage found — auto-fallback to Hyperframe"
                    })
                    continue

                # Download top candidate
                import pathlib
                clips_dir = pathlib.Path(args.project_dir) / "clips"
                clips_dir.mkdir(exist_ok=True)

                candidates = []
                for i, r in enumerate(candidates_res[:5]):
                    try:
                        cpath = str(clips_dir / f"seg{seg['id']}_cand{i}.mp4")
                        download_clip(r["download_url"], cpath)
                        candidates.append({
                            "path": cpath, "url": r["url"],
                            "duration": r["duration"], "preview": r["preview"],
                        })
                    except Exception:
                        continue

                seg["pexels_candidates"] = candidates
                if candidates:
                    seg["selected_clip"] = candidates[0]["path"]
                    results.append({
                        "id": seg["id"], "text": seg.get("text", ""),
                        "source": "pexels", "selected_clip": candidates[0]["path"],
                        "candidates": candidates,
                    })
                else:
                    seg["source"] = "hyperframe"
                    results.append({
                        "id": seg["id"], "text": seg.get("text", ""),
                        "source": "hyperframe", "selected_clip": None,
                        "error": "All downloads failed"
                    })

            else:
                # Hyperframe: generate animated MP4
                import subprocess
                import pathlib
                clips_dir = pathlib.Path(args.project_dir) / "clips"
                clips_dir.mkdir(exist_ok=True)
                output = str(clips_dir / f"seg{seg['id']}_hyperframe.mp4")
                text = seg.get("text", "")[:100]
                duration = seg.get("duration_sec", 5)

                # Generate gradient-colored frame (fallback — full Hyperframes engine TBD)
                # The real Hyperframe engine (from html-video fork) handles HTML+CSS+GSAP
                # → Chromium → MP4 with full text rendering and animations.
                # This fallback produces a colored placeholder to prove the pipeline works.
                colors = ["0x1a1a2e", "0x16213e", "0x0f3460", "0x533483", "0xe94560"]
                color = colors[seg["id"] % len(colors)]
                cmd = [
                    "ffmpeg", "-y",
                    "-f", "lavfi",
                    "-i", f"color=c={color}:s=1920x1080:d={duration}",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-pix_fmt", "yuv420p", output
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                if result.returncode != 0:
                    raise RuntimeError(f"ffmpeg failed: {result.stderr[-300:]}")
                if not os.path.exists(output):
                    raise RuntimeError(f"Output file not created: {output}")
                seg["selected_clip"] = output
                seg["hyperframe_html"] = ""  # Placeholder

                results.append({
                    "id": seg["id"], "text": seg.get("text", ""),
                    "source": "hyperframe", "selected_clip": output,
                })

        except Exception as e:
            results.append({
                "id": seg["id"], "text": seg.get("text", ""),
                "source": source, "selected_clip": None,
                "error": str(e),
            })

    # Save updated manifest
    manifest["segments"] = segments
    save_project(args.project_dir, manifest)

    succeeded = sum(1 for r in results if r.get("selected_clip") and not r.get("error"))
    print(json.dumps({
        "success": True,
        "project_dir": os.path.abspath(args.project_dir),
        "results": results,
        "stats": {"total": len(results), "succeeded": succeeded, "failed": len(results) - succeeded},
    }))


def cmd_regenerate(args):
    """Regenerate a single segment."""
    manifest = load_project(args.project_dir)
    segments = manifest.get("segments", [])

    seg = next((s for s in segments if s["id"] == args.segment_id), None)
    if not seg:
        print(json.dumps({"error": f"Segment {args.segment_id} not found"}))
        return

    source = seg.get("source", "pexels")
    try:
        if source == "pexels":
            query = args.query or seg.get("pexels_query", seg.get("text", ""))
            candidates_res = search_videos(query, per_page=5)

            import pathlib
            clips_dir = pathlib.Path(args.project_dir) / "clips"
            candidates = []
            for i, r in enumerate(candidates_res[:5]):
                try:
                    cpath = str(clips_dir / f"seg{seg['id']}_cand{i}.mp4")
                    download_clip(r["download_url"], cpath)
                    candidates.append({
                        "path": cpath, "url": r["url"],
                        "duration": r["duration"], "preview": r["preview"],
                    })
                except Exception:
                    continue

            seg["pexels_candidates"] = candidates
            seg["pexels_query"] = query
            if candidates:
                seg["selected_clip"] = candidates[0]["path"]

            save_project(args.project_dir, manifest)
            print(json.dumps({
                "success": True,
                "clip_path": seg.get("selected_clip"),
                "candidates": candidates,
            }))
        else:
            # Hyperframe: regenerate
            import subprocess
            import pathlib
            clips_dir = pathlib.Path(args.project_dir) / "clips"
            output = str(clips_dir / f"seg{seg['id']}_hyperframe.mp4")
            text = seg.get("text", "")[:100]
            duration = seg.get("duration_sec", 5)

            # Generate colored frame (fallback — full Hyperframes engine handles text)
            colors = ["0x1a1a2e", "0x16213e", "0x0f3460", "0x533483", "0xe94560"]
            color = colors[seg["id"] % len(colors)]
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi",
                "-i", f"color=c={color}:s=1920x1080:d={duration}",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-pix_fmt", "yuv420p", output
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {result.stderr[-300:]}")
            if not os.path.exists(output):
                raise RuntimeError(f"Output file not created: {output}")
            seg["selected_clip"] = output
            save_project(args.project_dir, manifest)

            print(json.dumps({
                "success": True,
                "clip_path": output,
            }))
    except Exception as e:
        print(json.dumps({"error": str(e)}))


def cmd_merge(args):
    """Merge all clips with voiceover."""
    manifest = load_project(args.project_dir)
    segments = manifest.get("segments", [])
    voiceover_rel = manifest.get("voiceover_path", "")
    voiceover_path = os.path.join(args.project_dir, voiceover_rel)

    output_dir = os.path.join(args.project_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "final.mp4")

    result = merge_hard_cuts(segments, voiceover_path, output_path, args.subtitles)

    print(json.dumps({
        "success": True,
        "output_path": result,
        "project_dir": os.path.abspath(args.project_dir),
    }))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("create-project")
    p.add_argument("--project-dir", required=True)
    p.add_argument("--script", required=True)
    p.add_argument("--audio-path", required=True)

    p = sub.add_parser("plan-scenes")
    p.add_argument("--script", required=True)
    p.add_argument("--audio-path", required=True)
    p.add_argument("--project-dir", default="")

    p = sub.add_parser("generate")
    p.add_argument("--project-dir", required=True)

    p = sub.add_parser("regenerate")
    p.add_argument("--project-dir", required=True)
    p.add_argument("--segment-id", type=int, required=True)
    p.add_argument("--query", default="")

    p = sub.add_parser("merge")
    p.add_argument("--project-dir", required=True)
    p.add_argument("--subtitles", action="store_true")

    args = parser.parse_args()

    cmds = {
        "create-project": cmd_create_project,
        "plan-scenes": cmd_plan_scenes,
        "generate": cmd_generate,
        "regenerate": cmd_regenerate,
        "merge": cmd_merge,
    }

    handler = cmds.get(args.command)
    if handler:
        handler(args)
    else:
        print(json.dumps({"error": f"Unknown command: {args.command}"}))
