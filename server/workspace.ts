import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PROFILE, GenerationSchema, ProfileSchema, WorkspaceSchema, type Generation, type WorkspaceProfile } from '../src/lib/workspace';
import { DATA_DIR } from './config';

const WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');

const readWorkspace = () => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf8'));
    const parsed = WorkspaceSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  } catch {
    // A first run or interrupted write starts with an empty local workspace.
  }
  return { generations: [], profile: DEFAULT_PROFILE };
};

const writeWorkspace = (workspace: ReturnType<typeof readWorkspace>) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = `${WORKSPACE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(workspace, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, WORKSPACE_FILE);
};

export const getWorkspace = () => {
  const workspace = readWorkspace();
  workspace.generations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return workspace;
};

export const saveGeneration = (input: unknown): Generation => {
  const generation = GenerationSchema.parse(input);
  const workspace = readWorkspace();
  const index = workspace.generations.findIndex((item) => item.id === generation.id);
  if (index === -1) workspace.generations.push(generation);
  else workspace.generations[index] = generation;
  writeWorkspace(workspace);
  return generation;
};

export const saveProfile = (input: unknown): WorkspaceProfile => {
  const profile = ProfileSchema.parse(input);
  const workspace = readWorkspace();
  workspace.profile = profile;
  writeWorkspace(workspace);
  return profile;
};
