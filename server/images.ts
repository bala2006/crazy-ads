import { z } from 'zod';

export const ReferenceSchema = z.object({
  name: z.string().min(1).max(120),
  dataUrl: z
    .string()
    .max(2_000_000)
    .refine((value) => {
      const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match) return false;
      const bytes = Buffer.from(match[2]!, 'base64');
      if (bytes.length < 12 || bytes.length > 1_500_000) return false;
      if (match[1] === 'png')
        return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (match[1] === 'jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    }, 'Use a PNG, JPEG, or WebP image under 1.5 MB.'),
});
export type ImageReference = z.infer<typeof ReferenceSchema>;
