#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const defaultBaselinePath = 'examples/evaluation/actual-render-baseline.json';
const defaultRenderDir = 'artifacts/actual-render';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function hammingDistance(first, second) {
  let value = BigInt(`0x${first}`) ^ BigInt(`0x${second}`);
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

export function compareRenderSignature(expected, actual, maxHammingDistance = 4) {
  const dimensionsMatch = expected.width === actual.width && expected.height === actual.height;
  const distance = hammingDistance(expected.dhash, actual.dhash);
  return {
    pass: dimensionsMatch && distance <= maxHammingDistance,
    dimensionsMatch,
    hammingDistance: distance,
    expected,
    actual
  };
}

async function computeSignature(page, filePath) {
  const data = fs.readFileSync(filePath).toString('base64');
  const dataUrl = `data:image/png;base64,${data}`;
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const grayAt = (x, y) => {
      const offset = (y * canvas.width + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3];
      const composite = (channel) => alpha === 255
        ? channel
        : Math.round((channel * alpha + 255 * (255 - alpha)) / 255);
      return Math.round(0.299 * composite(red) + 0.587 * composite(green) + 0.114 * composite(blue));
    };
    let bits = 0n;
    for (let row = 0; row < 8; row += 1) {
      const y = Math.min(canvas.height - 1, Math.floor((row + 0.5) * canvas.height / 8));
      const values = [];
      for (let column = 0; column < 9; column += 1) {
        const x = Math.min(canvas.width - 1, Math.floor((column + 0.5) * canvas.width / 9));
        values.push(grayAt(x, y));
      }
      for (let column = 0; column < 8; column += 1) {
        bits = (bits << 1n) | (values[column] > values[column + 1] ? 1n : 0n);
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      dhash: bits.toString(16).padStart(16, '0')
    };
  }, dataUrl);
}

export async function verifyActualRenderSignatures(options = {}) {
  const baselinePath = path.resolve(rootDir, options.baselinePath ?? defaultBaselinePath);
  const renderDir = path.resolve(rootDir, options.renderDir ?? defaultRenderDir);
  const baseline = readJson(baselinePath);
  const maxHammingDistance = Number(
    options.maxHammingDistance ?? baseline.algorithm?.maxHammingDistance ?? 4
  );
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];
  try {
    for (const [fileName, expected] of Object.entries(baseline.renders ?? {})) {
      const filePath = path.join(renderDir, fileName);
      if (!fs.existsSync(filePath)) {
        results.push({ fileName, pass: false, reason: 'missing-render' });
        continue;
      }
      const actual = await computeSignature(page, filePath);
      results.push({
        fileName,
        ...compareRenderSignature(expected, actual, maxHammingDistance)
      });
    }
  } finally {
    await browser.close();
  }
  const unexpected = fs.existsSync(renderDir)
    ? fs.readdirSync(renderDir)
        .filter((fileName) => fileName.endsWith('.png') && !(fileName in (baseline.renders ?? {})))
        .sort()
    : [];
  return {
    version: '0.1.0',
    baseline: path.relative(rootDir, baselinePath),
    renderDir: path.relative(rootDir, renderDir),
    maxHammingDistance,
    pass: results.every((result) => result.pass),
    results,
    unexpected
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--baseline') options.baselinePath = args[++index];
    else if (arg === '--render-dir') options.renderDir = args[++index];
    else if (arg === '--max-distance') options.maxHammingDistance = Number(args[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const report = await verifyActualRenderSignatures(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`verify-actual-render-signatures failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
