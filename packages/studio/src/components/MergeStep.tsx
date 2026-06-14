"use client";

export function MergeStep({ outputPath }: { outputPath: string }) {
  const folderPath = outputPath.replace(/\/[^/]+$/, "");

  return (
    <div className="mt-8 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <h2 className="text-lg font-semibold text-emerald-400">Video Ready</h2>
          <p className="text-sm text-neutral-400">
            Your video has been merged and saved.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-neutral-900/50 p-4 font-mono text-sm text-neutral-300 break-all">
        {outputPath}
      </div>

      <div className="mt-4 flex gap-3">
        <a
          href={`file:///${outputPath.replace(/\\/g, "/")}`}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
        >
          Open Video
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(outputPath);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          Copy Path
        </button>
      </div>
    </div>
  );
}
