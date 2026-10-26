import type { ImageReference } from './api';

/** Decode and resize locally; only compressed references go to the text model. */
export const readReference = async (file: File): Promise<ImageReference> => {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12_000_000)
    throw new Error('Choose a PNG, JPEG, or WebP under 12 MB.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not read this image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    if (dataUrl.length > 2_000_000) throw new Error('Image is too detailed. Try a smaller image.');
    return { name: file.name.slice(0, 120), dataUrl };
  } finally {
    image.close();
  }
};
