"""
HDI Studio — Scene Planner

Coordinates Whisper alignment, sentence splitting, and source assignment.
Produces the Scene Plan: a list of segments with timestamps and source decisions.
"""

from . import whisper as _whisper
from . import pexels as _pexels


# Conceptual/abstract keywords that suggest Hyperframe instead of Pexels
_CONCEPTUAL_MARKERS = [
    "imagine", "dream", "concept", "idea", "maybe", "perhaps",
    "step", "tutorial", "how to", "understand", "remember",
    "history", "historical", "in the past", "once upon a time",
    "consider", "think about", "visualize", "suppose",
    "data", "statistics", "chart", "graph", "numbers show",
    "percent", "increase", "decrease", "growth", "trend",
    "process", "method", "technique", "approach", "strategy",
    "philosophy", "theory", "principle", "believe",
]


def _is_conceptual(sentence: str) -> bool:
    """Heuristic: check if a sentence describes a concept rather than a photographable scene."""
    lower = sentence.lower().strip(",.!?;: ")
    for marker in _CONCEPTUAL_MARKERS:
        if marker in lower:
            return True
    # Also check: very short sentences with no concrete nouns
    words = lower.split()
    if len(words) <= 2:
        return True  # Likely a transitional phrase
    return False


def _group_consecutive_hyperframes(segments: list[dict]) -> list[dict]:
    """
    Group consecutive Hyperframe segments into one merged segment.
    Pexels segments pass through unchanged.
    """
    if not segments:
        return segments

    grouped = []
    buffer = None  # Accumulates consecutive hyperframe segments

    for seg in segments:
        if seg["source"] == "hyperframe" and _is_conceptual(seg["text"]):
            if buffer is None:
                buffer = dict(seg)
                buffer["text"] = seg["text"]
            else:
                buffer["text"] += " " + seg["text"]
                buffer["end_ms"] = seg["end_ms"]
                buffer["duration_sec"] = round(
                    (buffer["end_ms"] - buffer["start_ms"]) / 1000.0, 2
                )
        else:
            if buffer is not None:
                grouped.append(buffer)
                buffer = None
            grouped.append(seg)

    if buffer is not None:
        grouped.append(buffer)

    # Re-index
    for i, seg in enumerate(grouped):
        seg["id"] = i

    return grouped


def plan_scenes(
    script_text: str,
    audio_path: str,
    pexels_api_key: str = "",
) -> dict:
    """
    Plan scenes from script + audio.

    1. Run Whisper alignment → timestamps
    2. Split into sentences → initial segments
    3. Assign source (Pexels or Hyperframe) per segment
    4. Group consecutive Hyperframe conceptual segments
    5. Return complete scene plan

    Returns:
        dict with:
            segments: list of segment dicts
            stats: {total, pexels_count, hyperframe_count, total_duration_sec}
    """
    # Step 1 & 2: Align + split
    raw_segments = _whisper.align(audio_path, script_text)

    # Step 3: Assign source
    for seg in raw_segments:
        if _is_conceptual(seg["text"]):
            seg["source"] = "hyperframe"
            seg["source_assigned"] = "hyperframe"
        else:
            seg["source"] = "pexels"
            seg["source_assigned"] = "pexels"

        # Initialize empty fields
        seg["pexels_query"] = ""
        seg["pexels_candidates"] = []
        seg["selected_clip"] = None
        seg["clip_start_ms"] = 0
        seg["transition"] = "cut"
        seg["hyperframe_html"] = None
        seg["history"] = []

    # Step 4: Group consecutive Hyperframe conceptual segments
    segments = _group_consecutive_hyperframes(raw_segments)

    # Step 5: Generate Pexels queries for Pexels segments
    for seg in segments:
        if seg["source"] == "pexels":
            seg["pexels_query"] = _generate_pexels_query(seg["text"], script_text)

    # Stats
    total_duration = sum(s.get("duration_sec", 0) for s in segments)
    pexels_count = sum(1 for s in segments if s["source"] == "pexels")
    hyperframe_count = sum(1 for s in segments if s["source"] == "hyperframe")

    return {
        "segments": segments,
        "stats": {
            "total": len(segments),
            "pexels_count": pexels_count,
            "hyperframe_count": hyperframe_count,
            "total_duration_sec": round(total_duration, 2),
        }
    }


def _generate_pexels_query(sentence: str, full_script: str) -> str:
    """
    Generate a Pexels search query from a sentence.
    Extracts key nouns and phrases, removes function words.
    This is a basic implementation — the Hermes agent will override with
    its own AI-generated query when called from the tool.
    """
    # Simple keyword extraction: remove common stop words, keep nouns
    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been",
        "it", "its", "this", "that", "these", "those", "of", "in",
        "to", "for", "on", "at", "by", "with", "from", "as", "or",
        "and", "but", "not", "no", "just", "maybe", "perhaps",
        "there", "here", "where", "when", "how", "what", "which",
        "who", "whom", "your", "you", "i", "me", "my", "we", "our",
        "he", "she", "they", "them", "his", "her", "their",
        "doesn't", "don't", "can't", "won't", "have", "has", "had",
        "do", "does", "did", "will", "would", "could", "should",
        "very", "really", "quite", "rather", "some", "any", "many",
        "much", "few", "little", "more", "most", "all", "every",
        "each", "both", "few", "several", "about", "around",
    }

    words = sentence.lower().strip(",.!?;: ").split()
    keywords = [w for w in words if w not in stop_words and len(w) > 2]
    return " ".join(keywords) if keywords else sentence.lower()
