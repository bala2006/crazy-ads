import { z } from 'zod';
import { StoryboardSchema } from '../remotion/schema';

export const RenderArtifactSchema = z.object({
  url: z.string().regex(/^\/renders\/[a-z0-9-]+\.mp4$/),
  fileName: z.string().min(1).max(180),
  bytes: z.number().int().nonnegative(),
  ms: z.number().nonnegative(),
});

export const GenerationSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(120),
  source: z.enum(['ai', 'local', 'manual', 'imported']),
  storyboard: StoryboardSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  render: RenderArtifactSchema.optional(),
  revision: z.number().int().nonnegative().optional(),
});

export const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  workspaceName: z.string().trim().min(1).max(80),
});

export const WorkspaceSchema = z.object({
  generations: z.array(GenerationSchema).max(5000),
  profile: ProfileSchema,
});

export type Generation = z.infer<typeof GenerationSchema>;
export type WorkspaceProfile = z.infer<typeof ProfileSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const DEFAULT_PROFILE: WorkspaceProfile = {
  name: 'Studio Owner',
  workspaceName: 'My workspace',
};
