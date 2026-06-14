"""
HDI Studio — Whisper Forced Alignment

Uses faster-whisper for word-level timestamp alignment.
Given a script text and audio file, produces per-segment start/end timestamps.
"""

import json
import re
from pathlib import Path
from typing import Optional


def _load_whisper():
    """Lazy-load faster-whisper to avoid import on tool registration."""
    try:
        from faster_whisper import WhisperModel
        return WhisperModel
    except ImportError:
        raise RuntimeError(
            "faster-whisper not installed. Run: pip install faster-whisper"
        )


def _split_sentences(text: str) -> list[str]:
    """
    Split text into sentences on . ! ?
    Keeps punctuation attached.
    """
    # Split on sentence-ending punctuation followed by space or end
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]


def _word_timestamps_to_sentence_spans(
    words: list[dict], sentences: list[str]
) -> list[dict]:
    """
    Map word-level timestamps to sentence-level spans.
    Uses a greedy word-count matching approach.
    """
    segments = []
    word_idx = 0

    for sent_idx, sentence in enumerate(sentences):
        # Count words in this sentence
        sent_word_count = len(sentence.split())

        if word_idx >= len(words):
            break

        start_ms = words[word_idx]["start_ms"]
        # End at the last word of this sentence
        end_word_idx = min(word_idx + sent_word_count, len(words)) - 1
        end_ms = words[end_word_idx]["end_ms"]

        segments.append({
            "id": sent_idx,
            "text": sentence,
            "start_ms": int(start_ms),
            "end_ms": int(end_ms),
            "duration_sec": round((end_ms - start_ms) / 1000.0, 2),
        })

        word_idx += sent_word_count

    return segments


def align(audio_path: str, script_text: str, model_size: str = "base") -> list[dict]:
    """
    Run forced alignment: transcribe audio with faster-whisper,
    map word timestamps to sentences from the script.

    Returns list of segment dicts with: id, text, start_ms, end_ms, duration_sec.

    The script_text is the source of truth for words — Whisper provides
    timestamps only. If Whisper's transcription diverges from the script,
    we fall back to even time distribution across sentences.
    """
    audio = Path(audio_path)
    if not audio.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    WhisperModel = _load_whisper()

    # Use CPU by default; CUDA if available
    import os as _os
    device = "cuda" if _os.environ.get("WHISPER_DEVICE") == "cuda" else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        str(audio),
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
    )

    # Collect word-level timestamps
    words = []
    for seg in segments:
        if seg.words:
            for w in seg.words:
                words.append({
                    "word": w.word.strip(),
                    "start_ms": w.start * 1000,
                    "end_ms": w.end * 1000,
                })

    # Split script into sentences
    sentences = _split_sentences(script_text)

    if words:
        result = _word_timestamps_to_sentence_spans(words, sentences)
    else:
        # Fallback: even time distribution
        total_duration = info.duration * 1000
        chunk = total_duration / len(sentences) if sentences else 0
        result = []
        for i, s in enumerate(sentences):
            result.append({
                "id": i,
                "text": s,
                "start_ms": int(i * chunk),
                "end_ms": int((i + 1) * chunk),
                "duration_sec": round(chunk / 1000.0, 2),
            })

    return result


def check_whisper_installed() -> bool:
    """Check if faster-whisper is available."""
    try:
        from faster_whisper import WhisperModel
        return True
    except ImportError:
        return False
