import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import os from "os";

const DESKTOP = path.join(os.homedir(), "Desktop");
const ENGINE = path.join(DESKTOP, "hdi-studio", "engine", "server.py");
const PYTHON = "python";

function callEngine(args: string): any {
  const cmd = `${PYTHON} "${ENGINE}" ${args}`;
  try {
    const stdout = execSync(cmd, {
      timeout: 120000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e: any) {
    const stderr = e.stderr || "";
    try {
      return JSON.parse(e.stdout || stderr);
    } catch {
      return { error: stderr.slice(-500) || e.message };
    }
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { script, audio_path, project_name } = body;

  if (!script || !audio_path || !project_name) {
    return NextResponse.json(
      { error: "script, audio_path, and project_name are required" },
      { status: 400 }
    );
  }

  const projectDir = path.join(DESKTOP, `${project_name}.hdi`);

  // Escape arguments for shell
  const escScript = script.replace(/"/g, '\\"').replace(/\n/g, "\\n");
  const result = callEngine(
    `create-project --project-dir "${projectDir}" --script "${escScript}" --audio-path "${audio_path}"`
  );

  if (result.error) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
