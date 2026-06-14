"""
HDI Studio — FFmpeg Video Merge Pipeline

Concatenates per-segment clips with voiceover track into final 1080p 16:9 MP4.
Supports hard cuts and crossfade transitions.
"""

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Optional


def _create_concat_file(clips: list[str], output_path: str) -> str:
    """Create an FFmpeg concat demuxer file."""
    with open(output_path, "w", encoding="utf-8") as f:
        for clip in clips:
            # Escape single quotes and special chars for FFmpeg concat format
            escaped = str(clip).replace("'", "'\\''")
            f.write(f"file '{escaped}'\n")
    return output_path


def merge_hard_cuts(
    segments: list[dict],
    audio_path: str,
    output_path: str,
    add_subtitles: bool = False,
) -> str:
    """
    Concatenate all clips with hard cuts, add voiceover, output 1080p MP4.

    segments: list of dicts with 'selected_clip' (path to clip)
    audio_path: path to voiceover file
    output_path: where to write the final MP4
    add_subtitles: if True, burn subtitles from segment text
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    clips = [seg.get("selected_clip") for seg in segments if seg.get("selected_clip")]
    if not clips:
        raise RuntimeError("No clips to merge")

    # Create concat file
    concat_file = str(output.parent / "_concat.txt")
    _create_concat_file(clips, concat_file)

    # Build ffmpeg command
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",  # End when the shorter of video/audio ends
        "-movflags", "+faststart",
        str(output)
    ]

    if add_subtitles and segments:
        # Generate SRT subtitles file
        srt_path = str(output.parent / "_subtitles.srt")
        _write_srt(segments, srt_path)
        # Insert subtitles filter before scale
        sub_idx = cmd.index("-vf") + 1
        cmd[sub_idx] = f"subtitles={srt_path}:force_style='FontSize=24,Alignment=2'," + cmd[sub_idx]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    finally:
        # Cleanup concat file
        try:
            Path(concat_file).unlink(missing_ok=True)
        except Exception:
            pass

    if result.returncode != 0:
        # Diagnose: which clip might have failed?
        error_output = result.stderr
        for i, clip in enumerate(clips):
            if str(clip) in error_output:
                raise RuntimeError(
                    f"FFmpeg merge failed on segment {i} ({clip}): {error_output[-500:]}"
                )
        raise RuntimeError(f"FFmpeg merge failed: {error_output[-500:]}")

    return str(output)


def merge_crossfade(
    segments: list[dict],
    audio_path: str,
    output_path: str,
    crossfade_duration: float = 0.4,
) -> str:
    """
    Merge clips with crossfade transitions.
    More complex: uses ffmpeg filter_complex for xfade.
    """
    clips = [seg.get("selected_clip") for seg in segments if seg.get("selected_clip")]
    if len(clips) < 2:
        return merge_hard_cuts(segments, audio_path, output_path)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    # Build filter complex for crossfade chain
    inputs = []
    for clip in clips:
        inputs.extend(["-i", str(clip)])

    # Build crossfade filters
    filter_parts = []
    offset = 0.0
    last_label = "[0:v]"

    for i in range(1, len(clips)):
        seg_duration = segments[i - 1].get("duration_sec", 2.0)
        offset += seg_duration - crossfade_duration
        next_label = f"[v{i}]" if i < len(clips) - 1 else "[vout]"
        filter_parts.append(
            f"{last_label}[{i}:v]xfade=transition=fade:duration={crossfade_duration}:offset={offset:.2f}{next_label}"
        )
        last_label = f"[{i}:v]"

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-i", audio_path,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", f"{len(clips)}:a",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        str(output)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        # Fall back to hard cuts on crossfade failure
        return merge_hard_cuts(segments, audio_path, output_path)

    return str(output)


def _write_srt(segments: list[dict], output_path: str) -> None:
    """Write SRT subtitle file from segment data."""
    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            start_ms = seg.get("start_ms", 0)
            end_ms = seg.get("end_ms", 0)
            text = seg.get("text", "")

            start_ts = _ms_to_srt_time(start_ms)
            end_ts = _ms_to_srt_time(end_ms)

            f.write(f"{i}\n")
            f.write(f"{start_ts} --> {end_ts}\n")
            f.write(f"{text}\n\n")


def _ms_to_srt_time(ms: int) -> str:
    """Convert milliseconds to SRT timestamp format HH:MM:SS,mmm."""
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    ms_rem = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms_rem:03d}"
