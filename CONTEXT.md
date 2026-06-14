# HDI Studio — Context

A local video creation dashboard. Given a narration script and a voiceover recording, it plans scenes, retrieves or generates footage per scene, lets the user review and refine, then merges everything into a single MP4.

Built as a fork of [nexu-io/html-video](https://github.com/nexu-io/html-video) — inherits the Hyperframes engine and FFmpeg pipeline, replaces the studio UI, adds Pexels stock footage as a second engine alongside Hyperframe, and adds Whisper-based forced alignment for scene planning.

Runs on a dedicated Hermes profile (`hdi-studio`) with custom tools for scene planning, footage generation, and video merging.

**Studio stack:** Next.js (inherited from fork) + Radix UI (accessible primitives) + Tailwind CSS (utility styling).

**Agent runtime:** Hermes with a custom `hdi-studio` toolset (profile-scoped). Tools: `hdi_plan_scenes`, `hdi_generate_footage`, `hdi_merge`. Hermes subagents handle parallel generation.

---

## Glossary

**Narration Script**
The full written text — the source of truth for what story is being told. Drives video semantics (what should be shown, overall narrative arc, conceptual grouping decisions). Not used for timing.

**Voiceover Track**
The audio file (recorded narration). Drives timing only — via forced alignment, it provides per-segment start/end timestamps. The script text, not the audio, determines the words.

**Segment**
The atomic unit of video. One segment = one clip in the timeline. A segment is:
- Initially derived from sentence boundaries in the Narration Script
- May group multiple consecutive conceptual sentences into one segment when they form a single idea unit (e.g., a tutorial step-by-step, a historical recounting, an abstract passage)
- Has exactly one source assignment: Pexels or Hyperframe
- Has start and end timestamps from the Voiceover Track alignment

**Scene Plan**
The output of the "Plan the Scene" step. A table where each row is a Segment with:
- Segment number
- Sentence text (or grouped text for conceptual runs)
- Timestamp (start → end, in seconds)
- Assigned source (Pexels or Hyperframe)
- Toggle for user override of source assignment

**Pexels**
A footage source for photographable reality — concrete scenes, objects, places, people, and actions that exist and can be captured on camera. Footage is retrieved from the Pexels stock video API.

**Hyperframe**
A footage source for non-photographable content — concepts, tutorials, step-by-steps, historical events, abstract ideas, data, and text. Footage is generated (HTML+CSS+GSAP → headless Chromium → video). Output must be mixed-media: visual composition + optional kinetic typography. Never typography-only.

**Source Assignment**
The automatic decision made during scene planning: whether a segment should use Pexels (concrete, photographable) or Hyperframe (abstract, conceptual). The user may override any assignment.

**Generation**
The parallel process of producing video clips for all segments. Pexels segments query the stock API with agent-generated search terms; Hyperframe segments render through the Hyperframes engine. Runs via Hermes subagents for parallelism.

**Review**
The step after generation where the user inspects each segment's clip. For Pexels segments, a modal shows top-N stock video candidates with an editable search query and a regenerate button. For Hyperframe segments, regeneration produces a new composition. No limit on regeneration rounds; previous versions are cached for rollback.

**Timing Spine**
The Voiceover Track's timestamps determine when each clip starts and ends. Clips are trimmed to match their segment's duration. Audio timing is never stretched or compressed to fit footage.

**Transition**
The boundary between two consecutive segments in the merged video. Default: hard cut. User may opt into crossfade per transition pair.

**Merge**
The final FFmpeg step that concatenates all clips with the Voiceover Track into a single 1080p 16:9 MP4. Output is auto-saved to disk.

**Project**
A saved state directory (`.hdi/`) containing the Narration Script, Voiceover Track, Scene Plan, all generated clips, and user decisions. Enables full resume after restart. The `project.json` manifest references media files within the directory.
