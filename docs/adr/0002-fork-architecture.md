# ADR 0002: Fork Architecture — Inherited vs Replaced

- **Date:** 2026-06-14
- **Decision:** Fork html-video, keep Hyperframes engine + FFmpeg pipeline + agent integration, replace studio UI, add Pexels adapter + Whisper alignment.
- **Status:** Accepted

## Decision

| Component | Action |
|-----------|--------|
| Hyperframes engine | Keep |
| FFmpeg pipeline | Keep |
| Agent integration | Keep |
| 21 templates | Keep |
| Studio UI | Replace |
| Source fetch | Drop |
| Soundtrack | Drop |

**Additions:** Pexels adapter, Whisper alignment, hdi-studio Hermes toolset.

## Consequences

- Inherit ~60% of codebase
- Can pull upstream improvements
- Studio replacement requires untangling from engine
- Hyperframe text rendering needs Playwright/Chromium (not ffmpeg drawtext)
