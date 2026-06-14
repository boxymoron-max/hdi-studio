import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import os from "os";

const ENGINE = path.join(os.homedir(), "Desktop", "hdi-studio", "engine", "server.py");

function callEngine(args: string): any {
  try {
    const stdout = execSync(`python "${ENGINE}" ${args}`, {
      timeout: 180000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e: any) {
    try { return JSON.parse(e.stdout || e.stderr || "{}"); }
    catch { return { error: (e.stderr || e.message || "").slice(-500) }; }
  }
}

export async function POST(req: Request) {
  const { project_dir } = await req.json();
  if (!project_dir) {
    return NextResponse.json({ error: "project_dir is required" }, { status: 400 });
  }
  const result = callEngine(`generate --project-dir "${project_dir}"`);
  if (result.error) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
