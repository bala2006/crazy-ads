import path from 'node:path';
import {
  DEFAULT_PROFILE,
  GenerationSchema,
  ProfileSchema,
  WorkspaceSchema,
  type Generation,
  type WorkspaceProfile,
} from '../src/lib/workspace';
import { DATA_DIR } from './config';
import { readJson, writeJson } from './storage';

const WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');

const readWorkspace = () => {
  const raw = readJson(WORKSPACE_FILE);
  return raw === undefined ? { generations: [], profile: DEFAULT_PROFILE } : WorkspaceSchema.parse(raw);
};

const writeWorkspace = (workspace: ReturnType<typeof readWorkspace>) => {
  writeJson(WORKSPACE_FILE, workspace);
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
  const current = workspace.generations[index];
  if (current && (generation.revision ?? 0) !== (current.revision ?? 0)) {
    throw Object.assign(new Error('This project changed in another tab. Reload it before saving again.'), {
      status: 409,
    });
  }
  generation.revision = (current?.revision ?? 0) + 1;
  generation.updatedAt = new Date().toISOString();
  if (index === -1) {
    if (workspace.generations.length >= 5000)
      throw new Error('Workspace is full. Back up and remove unused projects.');
    workspace.generations.push(generation);
  } else workspace.generations[index] = generation;
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

/** Link an output only if the project still matches the immutable render snapshot.
 * Artifact metadata does not advance the content revision or overwrite a newer edit. */
export const attachRender = (
  projectId: string,
  storyboard: Generation['storyboard'],
  render: NonNullable<Generation['render']>,
) => {
  const workspace = readWorkspace();
  const generation = workspace.generations.find((item) => item.id === projectId);
  if (!generation || JSON.stringify(generation.storyboard) !== JSON.stringify(storyboard)) return;
  generation.render = render;
  writeWorkspace(workspace);
};
