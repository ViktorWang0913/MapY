import type { GenerateImageResponse } from './mapCommands';

function responseDataUrl(response: GenerateImageResponse): string {
  return `data:${response.mimeType};base64,${response.data}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('生成图片无法读取。'));
    image.src = url;
  });
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('浏览器不支持 WebP 转换。')), 'image/webp', 0.9);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('图片编码失败。'));
    reader.readAsDataURL(blob);
  });
}

export async function normalizeGeneratedImage(response: GenerateImageResponse) {
  const image = await loadImage(responseDataUrl(response));
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法处理生成图片。');
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToWebp(canvas);
  return {
    dataUrl: await blobToDataUrl(blob),
    mimeType: 'image/webp',
    width,
    height
  };
}
