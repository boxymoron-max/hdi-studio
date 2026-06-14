"use client";

import { useState, useRef } from "react";

interface UploadStepProps {
  onPlanComplete: (projectDir: string, segments: any[], stats: any) => void;
  projectDir: string;
}

export function UploadStep({ onPlanComplete, projectDir: _projectDir }: UploadStepProps) {
  const [script, setScript] = useState("");
  const [projectName, setProjectName] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedAudioTypes = ".mp3,.wav,.m4a,.flac,.ogg";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFileName(file.name);
    }
  };

  const handlePlanScene = async () => {
    if (!projectName.trim()) {
      setError("Please enter a project name.");
      return;
    }
    if (!audioFileName) {
      setError("Please select a voiceover audio file.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Step 1: Create the project
      const createRes = await fetch("/api/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: script.trim(),
          audio_filename: audioFileName,
          project_name: projectName.trim(),
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({ error: "Failed to create project" }));
        throw new Error(errData.error || `Create project failed (${createRes.status})`);
      }

      const createData = await createRes.json();
      const projectDir: string = createData.project_dir;

      // Step 2: Plan the scenes
      const planRes = await fetch("/api/plan-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_dir: projectDir }),
      });

      if (!planRes.ok) {
        const errData = await planRes.json().catch(() => ({ error: "Failed to plan scenes" }));
        throw new Error(errData.error || `Plan scenes failed (${planRes.status})`);
      }

      const planData = await planRes.json();
      const segments = planData.segments || [];
      const stats = planData.stats || {};

      // Step 3: Notify parent
      onPlanComplete(projectDir, segments, stats);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while planning.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-100">
        Upload Your Materials
      </h2>

      {/* Narration Script */}
      <div className="space-y-2">
        <label
          htmlFor="script"
          className="block text-sm font-medium text-neutral-300"
        >
          Narration Script
        </label>
        <textarea
          id="script"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Paste your full narration script here…"
          className="w-full min-h-[200px] rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500
                     focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500
                     resize-y"
          rows={8}
        />
      </div>

      {/* Voiceover Audio */}
      <div className="space-y-2">
        <label
          htmlFor="audio-file"
          className="block text-sm font-medium text-neutral-300"
        >
          Voiceover Audio
        </label>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200
                            hover:bg-neutral-700 hover:border-neutral-600
                            focus-within:outline-none focus-within:ring-2 focus-within:ring-red-500/50
                            transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Choose File
            <input
              ref={fileInputRef}
              id="audio-file"
              type="file"
              accept={acceptedAudioTypes}
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
          {audioFileName ? (
            <span className="text-sm text-neutral-300 truncate max-w-[300px]">
              {audioFileName}
            </span>
          ) : (
            <span className="text-sm text-neutral-500">
              .mp3, .wav, .m4a, .flac, .ogg
            </span>
          )}
        </div>
      </div>

      {/* Project Name */}
      <div className="space-y-2">
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-neutral-300"
        >
          Project Name
        </label>
        <input
          id="project-name"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="My Video Project"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500
                     focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
        />
        <p className="text-xs text-neutral-500">
          Creates <code className="text-neutral-400 bg-neutral-800 px-1 py-0.5 rounded text-xs">{projectName || "name"}.hdi</code> on your Desktop
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Plan Button */}
      <button
        onClick={handlePlanScene}
        disabled={loading}
        className="w-full rounded-lg bg-red-500 px-6 py-3 text-sm font-semibold text-white
                   hover:bg-red-600
                   focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors
                   flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin text-white"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Planning scenes…
          </>
        ) : (
          "Plan the Scene"
        )}
      </button>
    </div>
  );
}
