"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MergeStep } from "@/components/MergeStep";

// ── Types ──────────────────────────────────────────────────────────────────

interface PexelsCandidate {
  path: string;
  url: string;
  duration: number;
  preview: string;
}

interface Segment {
  id: number;
  text: string;
  start_ms: number;
  end_ms: number;
  duration_sec: number;
  source: "pexels" | "hyperframe";
  source_assigned: "pexels" | "hyperframe";
  pexels_query: string;
  pexels_candidates: PexelsCandidate[];
  selected_clip: string | null;
  clip_start_ms: number;
  transition: "cut" | "crossfade";
  hyperframe_html: string | null;
  history: Array<any>;
  error?: string;
}

interface ReviewStepProps {
  segments: Segment[];
  generating: boolean;
  onRegenerate: (segmentId: number, newQuery?: string) => void;
  onMerge: (subtitles: boolean) => void;
  mergePath: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clipStatus(
  seg: Segment,
  generating: boolean,
): "hasClip" | "error" | "generating" | "pending" {
  if (generating) return "generating";
  if (seg.error) return "error";
  if (seg.selected_clip) return "hasClip";
  return "pending";
}

const statusBadge: Record<
  ReturnType<typeof clipStatus>,
  { label: string; cls: string }
> = {
  hasClip: { label: "✓ Clip ready", cls: "bg-emerald-900/60 text-emerald-300 border-emerald-700/60" },
  error: { label: "✗ Error", cls: "bg-red-900/60 text-red-300 border-red-700/60" },
  generating: { label: "⏳ Generating…", cls: "bg-amber-900/60 text-amber-300 border-amber-700/60" },
  pending: { label: "○ Pending", cls: "bg-neutral-800 text-neutral-400 border-neutral-700" },
};

const sourceBadge: Record<
  Segment["source_assigned"],
  { label: string; cls: string }
> = {
  pexels: { label: "Pexels", cls: "bg-sky-900/60 text-sky-300 border-sky-700/60" },
  hyperframe: { label: "Hyperframe", cls: "bg-purple-900/60 text-purple-300 border-purple-700/60" },
};

function textPreview(text: string, maxLen = 80): string {
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PexelsModalContent({
  segment,
  onRegenerate,
}: {
  segment: Segment;
  onRegenerate: (segmentId: number, newQuery?: string) => void;
}) {
  const [query, setQuery] = useState(segment.pexels_query);
  const [loading, setLoading] = useState(false);

  const handleRegenerate = () => {
    setLoading(true);
    onRegenerate(segment.id, query || undefined);
  };

  return (
    <div className="space-y-5">
      {/* Search query */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
          Search query
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query…"
          />
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Searching…" : "Regenerate"}
          </button>
        </div>
      </div>

      {/* Candidates */}
      {segment.pexels_candidates.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Candidates ({segment.pexels_candidates.length})
          </p>
          <div className="grid grid-cols-2 gap-3">
            {segment.pexels_candidates.map((c, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
              >
                {c.preview ? (
                  <img
                    src={c.preview}
                    alt={`Candidate ${i + 1}`}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-neutral-800 text-xs text-neutral-500">
                    No preview
                  </div>
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs text-neutral-400">
                    {c.duration.toFixed(1)}s
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {segment.pexels_candidates.length === 0 && (
        <p className="text-sm text-neutral-500">
          No candidates found. Try adjusting the search query.
        </p>
      )}
    </div>
  );
}

function HyperframeModalContent({
  segment,
  onRegenerate,
}: {
  segment: Segment;
  onRegenerate: (segmentId: number, newQuery?: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleRegenerate = () => {
    setLoading(true);
    onRegenerate(segment.id);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Segment text
        </p>
        <p className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm leading-relaxed text-neutral-200">
          {segment.text}
        </p>
      </div>

      {segment.hyperframe_html && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-400">
            HTML preview
          </p>
          <pre className="max-h-48 overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-300">
            {segment.hyperframe_html.slice(0, 1000)}
            {segment.hyperframe_html.length > 1000 && "\n…"}
          </pre>
        </div>
      )}

      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Regenerating…" : "Regenerate"}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ReviewStep({
  segments,
  generating,
  onRegenerate,
  onMerge,
  mergePath,
}: ReviewStepProps) {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [subtitles, setSubtitles] = useState(true);
  const [merging, setMerging] = useState(false);

  const handleMerge = () => {
    setMerging(true);
    onMerge(subtitles);
  };

  return (
    <div className="space-y-8">
      {/* Segment cards grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Review Clips</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => {
            const status = clipStatus(seg, generating);
            const badge = statusBadge[status];
            const src = sourceBadge[seg.source_assigned];

            return (
              <Dialog.Root key={seg.id}>
                <Dialog.Trigger asChild>
                  <button
                    className="group w-full rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:border-neutral-600 hover:bg-neutral-800/80 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    onClick={() => setSelectedSegment(seg)}
                  >
                    {/* Header row */}
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Segment #{seg.id}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${src.cls}`}
                      >
                        {src.label}
                      </span>
                    </div>

                    {/* Text preview */}
                    <p className="mb-3 text-sm leading-relaxed text-neutral-300">
                      {textPreview(seg.text)}
                    </p>

                    {/* Status */}
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </button>
                </Dialog.Trigger>

                {/* Modal */}
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                  <Dialog.Content className="fixed inset-x-4 top-[10%] z-50 mx-auto max-h-[75vh] max-w-xl overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[5%] data-[state=open]:slide-in-from-top-[5%]">
                    {/* Title bar */}
                    <div className="mb-5 flex items-center justify-between">
                      <Dialog.Title className="text-lg font-semibold text-neutral-100">
                        Segment #{selectedSegment?.id}
                        {selectedSegment && (
                          <span
                            className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sourceBadge[selectedSegment.source_assigned].cls}`}
                          >
                            {sourceBadge[selectedSegment.source_assigned].label}
                          </span>
                        )}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </Dialog.Close>
                    </div>

                    <Dialog.Description asChild>
                      <div>
                        {selectedSegment?.source_assigned === "pexels" ? (
                          <PexelsModalContent
                            segment={selectedSegment}
                            onRegenerate={onRegenerate}
                          />
                        ) : selectedSegment ? (
                          <HyperframeModalContent
                            segment={selectedSegment}
                            onRegenerate={onRegenerate}
                          />
                        ) : null}
                      </div>
                    </Dialog.Description>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            );
          })}
        </div>

        {segments.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            No segments to review.
          </p>
        )}
      </div>

      {/* Merge section */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">
          Export Video
        </h2>

        <label className="mb-4 flex cursor-pointer items-center gap-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={subtitles}
            onChange={(e) => setSubtitles(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 accent-sky-500"
          />
          Burn subtitles into video
        </label>

        <button
          onClick={handleMerge}
          disabled={merging || generating}
          className="w-full rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {merging ? "Merging…" : "Merge Video"}
        </button>
      </div>

      {/* Merge result */}
      {mergePath && (
        <div className="mt-8">
          <MergeStep outputPath={mergePath} />
        </div>
      )}
    </div>
  );
}
