import * as vscode from 'vscode';
import * as tinycolor from 'tinycolor2';
import * as UPNG from 'upng-js';
import * as jpeg from 'jpeg-js';

export type PaletteStrategy = 'dominant' | 'vibrant' | 'muted' | 'pastel';

export interface ProjectIconOptions {
  path: string;
  patterns: string[];
  maxSize: number;
  strategy: PaletteStrategy;
}

interface PixelData {
  data: Uint8Array;
  width: number;
  height: number;
}

function bytesToAscii(bytes: Uint8Array) {
  let result = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    result += String.fromCharCode.apply(null, Array.prototype.slice.call(chunk));
  }
  return result;
}

function isPng(bytes: Uint8Array) {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function decodePng(bytes: Uint8Array): PixelData {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const image = UPNG.decode(input);
  const frames = UPNG.toRGBA8(image);
  return { data: new Uint8Array(frames[0]), width: image.width, height: image.height };
}

function decodeJpeg(bytes: Uint8Array): PixelData {
  const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { data: image.data as Uint8Array, width: image.width, height: image.height };
}

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function decodeIco(bytes: Uint8Array): PixelData {
  const count = readUint16(bytes, 4);
  if (count < 1 || bytes.length < 6 + count * 16) {
    throw new Error('Invalid ICO directory');
  }

  let selectedOffset = 6;
  let selectedArea = -1;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = bytes[entry] || 256;
    const height = bytes[entry + 1] || 256;
    if (width * height > selectedArea) {
      selectedArea = width * height;
      selectedOffset = entry;
    }
  }

  const size = readUint32(bytes, selectedOffset + 8);
  const offset = readUint32(bytes, selectedOffset + 12);
  const imageBytes = bytes.subarray(offset, offset + size);
  if (isPng(imageBytes)) {
    return decodePng(imageBytes);
  }

  const width = readUint32(imageBytes, 4);
  const height = Math.floor(readUint32(imageBytes, 8) / 2);
  const bitCount = readUint16(imageBytes, 14);
  const pixelOffset = readUint32(imageBytes, 0);
  if (!width || !height || bitCount !== 32 || pixelOffset >= imageBytes.length) {
    throw new Error('Only PNG and 32-bit ICO images are supported');
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = pixelOffset + ((height - 1 - y) * width + x) * 4;
      const target = (y * width + x) * 4;
      rgba[target] = imageBytes[source + 2];
      rgba[target + 1] = imageBytes[source + 1];
      rgba[target + 2] = imageBytes[source];
      rgba[target + 3] = imageBytes[source + 3];
    }
  }
  return { data: rgba, width, height };
}

function colorDistanceFromGray(red: number, green: number, blue: number) {
  return Math.max(red, green, blue) - Math.min(red, green, blue);
}

export function dominantColorFromPixels(pixels: Uint8Array) {
  const allBuckets: { [key: string]: number[] } = {};
  const colorfulBuckets: { [key: string]: number[] } = {};

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 128) {
      continue;
    }
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const key = `${red >> 4},${green >> 4},${blue >> 4}`;
    const bucket = allBuckets[key] || [0, 0, 0, 0];
    bucket[0] += 1;
    bucket[1] += red;
    bucket[2] += green;
    bucket[3] += blue;
    allBuckets[key] = bucket;

    const brightness = (red + green + blue) / 3;
    if (brightness > 24 && brightness < 235 && colorDistanceFromGray(red, green, blue) > 18) {
      colorfulBuckets[key] = bucket;
    }
  }

  const buckets = Object.keys(colorfulBuckets).length ? colorfulBuckets : allBuckets;
  const winner = Object.keys(buckets)
    .map(key => buckets[key])
    .sort((left, right) => right[0] - left[0])[0];
  if (!winner) {
    return undefined;
  }
  return tinycolor({
    r: winner[1] / winner[0],
    g: winner[2] / winner[0],
    b: winner[3] / winner[0],
  }).toHexString();
}

function dominantColorFromSvg(bytes: Uint8Array) {
  const svg = bytesToAscii(bytes);
  const candidates = svg.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || [];
  const counts: { [color: string]: number } = {};
  candidates.forEach(candidate => {
    const color = tinycolor(candidate);
    if (!color.isValid() || color.getAlpha() < 0.5) {
      return;
    }
    const hex = color.toHexString();
    const brightness = color.getBrightness();
    if (brightness > 20 && brightness < 238) {
      counts[hex] = (counts[hex] || 0) + 1;
    }
  });
  return Object.keys(counts).sort((left, right) => counts[right] - counts[left])[0];
}

export function applyPaletteStrategy(color: string, strategy: PaletteStrategy) {
  const value = tinycolor(color);
  switch (strategy) {
    case 'vibrant':
      return value.saturate(25).brighten(5).toHexString();
    case 'muted':
      return value.desaturate(30).toHexString();
    case 'pastel':
      return value.desaturate(15).lighten(20).toHexString();
    default:
      return value.toHexString();
  }
}

async function findProjectIcon(options: ProjectIconOptions) {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) {
    return undefined;
  }
  if (options.path) {
    return vscode.Uri.joinPath(folder.uri, options.path);
  }
  for (const pattern of options.patterns) {
    const matches = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, pattern),
      '**/{node_modules,.git}/**',
      1,
    );
    if (matches.length) {
      return matches[0];
    }
  }
  return undefined;
}

export async function getProjectIconColor(options: ProjectIconOptions) {
  const uri = await findProjectIcon(options);
  if (!uri) {
    return undefined;
  }
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.size > options.maxSize) {
    return undefined;
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  const path = uri.path.toLowerCase();
  let color: string | undefined;
  if (path.endsWith('.svg')) {
    color = dominantColorFromSvg(bytes);
  } else {
    let image: PixelData;
    if (path.endsWith('.ico')) {
      image = decodeIco(bytes);
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      image = decodeJpeg(bytes);
    } else {
      image = decodePng(bytes);
    }
    color = dominantColorFromPixels(image.data);
  }
  return color ? { color: applyPaletteStrategy(color, options.strategy), uri } : undefined;
}
