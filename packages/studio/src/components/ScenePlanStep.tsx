"use client";

import { useState } from "react";
import { Toggle } from "@radix-ui/react-toggle";

// ── Types ────────────────────────────────────────────────────────────────────

interface Segment {
  id: number;
  text: string;
  start_ms: number;
  end_ms: number;
  duration_sec: number;
  source: "pexels" | "hyperframe";
  source_assigned: "pexels" | "hyperframe";
  pexels_query: string;
  pexels_candidates: Array<{
    path: string;
    url: string;
    duration: number;
    preview: string;
  }>;
  selected_clip: string | null;
  clip_start_ms: number;
  transition: "cut" | "crossfade";
  hyperframe_html: string | null;
  history: Array<any>;
  error?: string;
}

interface ScenePlanStats {
  total: number;
  pexels_count: number;
  hyperframe_count: number;
  total_duration_sec: number;
}

interface ScenePlanStepProps {
  segments: Segment[];
  stats: ScenePlanStats;
  onSourcesUpdated: (segments: Segment[]) => void;
  onGenerate: () => void;
  generating: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatSegmentDuration(durationSec: number): string {
  const ms = Math.round(durationSec * 1000);
  if (ms >= 1000) {
    const s = (ms / 1000).toFixed(1);
    return `${s}s`;
  }
  return `${ms}ms`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScenePlanStep({
  segments,
  stats,
  onSourcesUpdated,
  onGenerate,
  generating,
}: ScenePlanStepProps) {
  const [editingQueries, setEditingQueries] = useState<Record<number, string>>(
    {}
  );

  // ── Source toggle handler ─────────────────────────────────────────────────

  const handleSourceToggle = (segmentId: number) => {
    const updated = segments.map((seg) => {
      if (seg.id !== segmentId) return seg;
      const newSource: "pexels" | "hyperframe" =
        seg.source === "pexels" ? "hyperframe" : "pexels";
      return { ...seg, source: newSource };
    });
    onSourcesUpdated(updated);
  };

  // ── Query change handler ──────────────────────────────────────────────────

  const handleQueryChange = (segmentId: number, value: string) => {
    setEditingQueries((prev) => ({ ...prev, [segmentId]: value }));
  };

  const handleQueryBlur = (segmentId: number) => {
    const newQuery = editingQueries[segmentId];
    if (newQuery === undefined) return;

    const updated = segments.map((seg) => {
      if (seg.id !== segmentId) return seg;
      return { ...seg, pexels_query: newQuery };
    });
    onSourcesUpdated(updated);
  };

  const handleQueryKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    segmentId: number
  ) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Segments" value={stats.total} />
        <StatCard label="Pexels Clips" value={stats.pexels_count} />
        <StatCard label="Hyperframes" value={stats.hyperframe_count} />
        <StatCard
          label="Total Duration"
          value={formatDuration(stats.total_duration_sec)}
        />
      </div>

      {/* ── Segments table ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
              <th className="w-10 px-4 py-3 font-medium text-neutral-400">#</th>
              <th className="px-4 py-3 font-medium text-neutral-400">Text</th>
              <th className="w-24 px-4 py-3 font-medium text-neutral-400">
                Duration
              </th>
              <th className="w-28 px-4 py-3 font-medium text-neutral-400">
                Source
              </th>
              <th className="px-4 py-3 font-medium text-neutral-400">Query</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {segments.map((seg, idx) => (
              <tr
                key={seg.id}
                className="transition-colors hover:bg-neutral-900/50"
              >
                {/* Row number */}
                <td className="px-4 py-3 text-neutral-500 tabular-nums">
                  {idx + 1}
                </td>

                {/* Sentence text */}
                <td className="max-w-xs px-4 py-3 text-neutral-200">
                  <p className="line-clamp-2 leading-relaxed">{seg.text}</p>
                </td>

                {/* Duration */}
                <td className="px-4 py-3 tabular-nums text-neutral-400">
                  {formatSegmentDuration(seg.duration_sec)}
                </td>

                {/* Source toggle */}
                <td className="px-4 py-3">
                  <Toggle
                    pressed={seg.source === "hyperframe"}
                    onPressedChange={() => handleSourceToggle(seg.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors
                      ${
                        seg.source === "pexels"
                          ? "border-emerald-700 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-950/60"
                          : "border-violet-700 bg-violet-950/40 text-violet-400 hover:bg-violet-950/60"
                      }
                    `}
                    aria-label={`Toggle source for segment ${seg.id}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        seg.source === "pexels"
                          ? "bg-emerald-400"
                          : "bg-violet-400"
                      }`}
                    />
                    {seg.source === "pexels" ? "Pexels" : "Hyperframe"}
                  </Toggle>
                </td>

                {/* Editable query (Pexels) or placeholder (Hyperframe) */}
                <td className="px-4 py-3">
                  {seg.source === "pexels" ? (
                    <input
                      type="text"
                      value={
                        editingQueries[seg.id] !== undefined
                          ? editingQueries[seg.id]
                          : seg.pexels_query
                      }
                      onChange={(e) =>
                        handleQueryChange(seg.id, e.target.value)
                      }
                      onBlur={() => handleQueryBlur(seg.id)}
                      onKeyDown={(e) => handleQueryKeyDown(e, seg.id)}
                      placeholder="Enter search query..."
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none transition-colors focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
                    />
                  ) : (
                    <span className="text-xs text-neutral-600 italic">
                      AI-generated
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Generate button ────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={onGenerate}
          disabled={generating}
          className={`inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold text-white transition-all
            ${
              generating
                ? "cursor-not-allowed bg-neutral-700"
                : "bg-red-600 hover:bg-red-500 active:scale-[0.98]"
            }
          `}
        >
          {generating && (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {generating ? "Generating..." : "Generate Footage"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-100">
        {value}
      </p>
    </div>
  );
}
