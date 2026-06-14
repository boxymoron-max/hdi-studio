"use client";

import { useState } from "react";
import { UploadStep } from "@/components/UploadStep";
import { ScenePlanStep } from "@/components/ScenePlanStep";
import { ReviewStep } from "@/components/ReviewStep";
import { MergeStep } from "@/components/MergeStep";
import { ProgressBar } from "@/components/ProgressBar";

type Step = "upload" | "plan" | "review" | "merge";

interface Segment {
  id: number;
  text: string;
  start_ms: number;
  end_ms: number;
  duration_sec: number;
  source: "pexels" | "hyperframe";
  source_assigned: "pexels" | "hyperframe";
  pexels_query: string;
  pexels_candidates: Array<{ path: string; url: string; duration: number; preview: string }>;
  selected_clip: string | null;
  clip_start_ms: number;
  transition: "cut" | "crossfade";
  hyperframe_html: string | null;
  history: Array<any>;
  error?: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [projectDir, setProjectDir] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResults, setGenerateResults] = useState<any[]>([]);
  const [mergePath, setMergePath] = useState<string>("");

  const handlePlanComplete = (dir: string, segs: Segment[], st: any) => {
    setProjectDir(dir);
    setSegments(segs);
    setStats(st);
    setStep("plan");
  };

  const handleSourcesUpdated = (updated: Segment[]) => {
    setSegments(updated);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setStep("review");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_dir: projectDir }),
      });

      const data = await res.json();
      if (data.success) {
        setGenerateResults(data.results || []);
        // Update segments with clip paths
        const updated = segments.map((seg) => {
          const result = (data.results || []).find((r: any) => r.id === seg.id);
          if (result) {
            return {
              ...seg,
              selected_clip: result.selected_clip || seg.selected_clip,
              error: result.error || seg.error,
              source: result.source || seg.source,
            };
          }
          return seg;
        });
        setSegments(updated);
      } else {
        alert(data.error || "Generation failed");
      }
    } catch (e: any) {
      alert("Generation error: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (segmentId: number, newQuery?: string) => {
    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_dir: projectDir,
          segment_id: segmentId,
          query: newQuery,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? { ...s, selected_clip: data.clip_path, pexels_candidates: data.candidates || s.pexels_candidates }
              : s
          )
        );
      }
    } catch (e: any) {
      alert("Regenerate error: " + e.message);
    }
  };

  const handleMerge = async (subtitles: boolean) => {
    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_dir: projectDir, add_subtitles: subtitles }),
      });
      const data = await res.json();
      if (data.success) {
        setMergePath(data.output_path);
        setStep("merge");
      } else {
        alert(data.error || "Merge failed");
      }
    } catch (e: any) {
      alert("Merge error: " + e.message);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-8 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-red-500">HDI</span> Studio
        </h1>
      </header>

      <div className="mx-auto max-w-5xl px-8 py-8">
        <ProgressBar currentStep={step} />

        {step === "upload" && (
          <UploadStep
            onPlanComplete={handlePlanComplete}
            projectDir={projectDir}
          />
        )}

        {step === "plan" && segments.length > 0 && (
          <ScenePlanStep
            segments={segments}
            stats={stats}
            onSourcesUpdated={handleSourcesUpdated}
            onGenerate={handleGenerate}
            generating={generating}
          />
        )}

        {(step === "review" || step === "merge") && segments.length > 0 && (
          <ReviewStep
            segments={segments}
            generating={generating}
            onRegenerate={handleRegenerate}
            onMerge={handleMerge}
            mergePath={mergePath}
          />
        )}

        {step === "merge" && mergePath && (
          <MergeStep outputPath={mergePath} />
        )}
      </div>
    </main>
  );
}
