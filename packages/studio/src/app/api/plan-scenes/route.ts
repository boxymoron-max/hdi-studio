import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import os from "os";

const ENGINE = path.join(os.homedir(), "Desktop", "hdi-studio", "engine", "server.py");

function callEngine(args: string): any {
  try {
    const stdout = execSync(`python "${ENGINE}" ${args}`, {
      timeout: 120000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e: any) {
    try { return JSON.parse(e.stdout || e.stderr || "{}"); }
    catch { return { error: (e.stderr || e.message || "").slice(-500) }; }
  }
}

export async function POST(req: Request) {
  const { script, audio_path, project_dir } = await req.json();

  if (!script || !audio_path) {
    return NextResponse.json({ error: "script and audio_path are required" }, { status: 400 });
  }

  const escScript = script.replace(/"/g, '\\"').replace(/\n/g, "\\n");
  const projectArg = project_dir ? `--project-dir "${project_dir}"` : "";
  const result = callEngine(
    `plan-scenes --script "${escScript}" --audio-path "${audio_path}" ${projectArg}`
  );

  if (result.error) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
