import { isTauri } from '@tauri-apps/api/core';
import type { ArtAsset } from './model/types';

export interface ImportedAssetFile extends Omit<ArtAsset, 'id' | 'createdAt'> {}

function isDesktopRuntime(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function browserDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openBrowserFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      resolve(file);
    };

    input.oncancel = () => {
      input.remove();
      resolve(undefined);
    };

    window.document.body.appendChild(input);
    input.click();
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(blob);
  });
}

function measureImage(dataUrl: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = dataUrl;
  });
}

function inferMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || 'asset';
}

export async function openJsonFile(): Promise<unknown | undefined> {
  if (isDesktopRuntime()) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ]);
    const path = await open({
      multiple: false,
      filters: [{ name: 'MapY JSON', extensions: ['json', 'mapy'] }]
    });

    if (!path || Array.isArray(path)) {
      return undefined;
    }

    return JSON.parse(await readTextFile(path));
  }

  const file = await openBrowserFile('application/json,.json,.mapy');
  if (!file) {
    return undefined;
  }

  return JSON.parse(await file.text());
}

export async function saveJsonFile(content: string, suggestedName: string): Promise<void> {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });

  if (isDesktopRuntime()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ]);
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: 'MapY JSON', extensions: ['json', 'mapy'] }]
    });

    if (path) {
      await writeTextFile(path, content);
    }
    return;
  }

  browserDownload(suggestedName, blob);
}

export async function saveImageFile(blob: Blob, suggestedName: string, mimeType: string): Promise<void> {
  if (isDesktopRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ]);
    const path = await save({
      defaultPath: suggestedName,
      filters: [
        {
          name: mimeType === 'image/jpeg' ? 'JPEG Image' : 'PNG Image',
          extensions: mimeType === 'image/jpeg' ? ['jpg', 'jpeg'] : ['png']
        }
      ]
    });

    if (path) {
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    }
    return;
  }

  browserDownload(suggestedName, blob);
}

export async function openAssetFile(): Promise<ImportedAssetFile | undefined> {
  if (isDesktopRuntime()) {
    const [{ open }, { readFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs')
    ]);
    const path = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }]
    });

    if (!path || Array.isArray(path)) {
      return undefined;
    }

    const mimeType = inferMimeType(path);
    const bytes = await readFile(path);
    const dataUrl = await blobToDataUrl(new Blob([bytes], { type: mimeType }));
    const dimensions = await measureImage(dataUrl);
    return {
      name: basename(path),
      dataUrl,
      mimeType,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  const file = await openBrowserFile('image/*');
  if (!file || !file.type.startsWith('image/')) {
    return undefined;
  }

  const dataUrl = await blobToDataUrl(file);
  const dimensions = await measureImage(dataUrl);
  return {
    name: file.name,
    dataUrl,
    mimeType: file.type || inferMimeType(file.name),
    width: dimensions.width,
    height: dimensions.height
  };
}
