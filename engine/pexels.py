"""
HDI Studio — Pexels Stock Footage Adapter

Uses Pexels API (api.pexels.com/videos) to search, retrieve candidates,
and download clips for a given segment.
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError
from urllib.parse import quote as _url_quote


PEXELS_API = "https://api.pexels.com/videos/search"


def _get_api_key() -> str:
    key = os.getenv("PEXELS_API_KEY", "")
    if not key:
        raise RuntimeError("PEXELS_API_KEY not set")
    return key


def search_videos(query: str, per_page: int = 10, min_duration: float = 0) -> list:
    """
    Search Pexels for videos matching a query.
    Returns list of video items with: id, duration, url, preview URLs.
    """
    api_key = _get_api_key()
    req = Request(f"{PEXELS_API}?query={_url_quote(query)}&per_page={per_page}")
    req.add_header("Authorization", api_key)

    try:
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except URLError as e:
        raise RuntimeError(f"Pexels API error: {e}")

    videos = data.get("videos", [])

    # Filter by minimum duration (in seconds)
    if min_duration > 0:
        videos = [v for v in videos if v.get("duration", 0) >= min_duration]

    # Extract relevant fields
    results = []
    for v in videos:
        # Get the best quality video file
        video_files = v.get("video_files", [])
        # Prefer HD, fall back to SD
        hd = [f for f in video_files if f.get("quality") == "hd"]
        sd = [f for f in video_files if f.get("quality") == "sd"]
        best = (hd or sd or video_files)[0] if video_files else {}

        results.append({
            "id": v.get("id"),
            "duration": v.get("duration", 0),
            "width": v.get("width", 0),
            "height": v.get("height", 0),
            "url": v.get("url", ""),
            "download_url": best.get("link", ""),
            "preview": v.get("image", ""),
            "user": v.get("user", {}).get("name", ""),
        })

    return results


def download_clip(download_url: str, output_path: str) -> str:
    """
    Download a Pexels clip to the specified path.
    Returns the output path on success.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    req = Request(download_url)
    req.add_header("User-Agent", "HDI-Studio/1.0")

    try:
        with urlopen(req, timeout=60) as resp:
            data = resp.read()
    except URLError as e:
        raise RuntimeError(f"Download failed: {e}")

    with open(output, "wb") as f:
        f.write(data)

    return str(output)


def trim_clip(input_path: str, output_path: str, start_sec: float, duration_sec: float) -> str:
    """
    Trim a video clip using ffmpeg.
    Extracts from start_sec for duration_sec seconds.
    Strips audio.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", input_path,
        "-t", str(duration_sec),
        "-an",  # strip audio
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        str(output)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg trim failed: {result.stderr[-500:]}")
    return str(output)
