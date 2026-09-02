#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { exportPreviewSvg } from './export-preview-svg.mjs';

const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureExtension(filePath, expected, label) {
  if (path.extname(filePath).toLowerCase() !== expected) {
    throw new Error(`${label} must use the ${expected} extension: ${filePath}`);
  }
}

export function isPngBuffer(value) {
  const buffer = Buffer.from(value);
  return buffer.length >= PNG_SIGNATURE.length
    && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

export function exportPreviewPng(scene, { maxWidth = 1800 } = {}) {
  const svg = exportPreviewSvg(scene);
  const widthMatch = svg.match(/<svg[^>]*\swidth="([0-9.]+)"/i);
  const sourceWidth = Number(widthMatch?.[1] ?? 0);
  const options = {
    font: { loadSystemFonts: true }
  };
  if (Number.isFinite(maxWidth) && maxWidth > 0 && sourceWidth > maxWidth) {
    options.fitTo = { mode: 'width', value: Math.round(maxWidth) };
  }
  const png = Buffer.from(new Resvg(svg, options).render().asPng());
  if (!isPngBuffer(png)) throw new Error('Portable preview renderer did not produce a valid PNG signature');
  return png;
}

export function writePreviewPng(scenePathArg, outputPathArg = null) {
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  ensureExtension(scenePath, '.excalidraw', 'Preview input');
  const outputPath = path.resolve(process.cwd(), outputPathArg ?? `${scenePathArg}.preview.png`);
  ensureExtension(outputPath, '.png', 'Preview output');
  const scene = readJson(scenePath);
  const png = exportPreviewPng(scene);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, png);
  return outputPath;
}

function parseArgs(args) {
  const scenePath = args[0];
  let outputPath = null;
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '-o' || args[index] === '--output') outputPath = args[++index] ?? null;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!scenePath) throw new Error('Usage: node src/export-preview-png.mjs <scene.excalidraw> [-o preview.png]');
  return { scenePath, outputPath };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = writePreviewPng(options.scenePath, options.outputPath);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    renderer: 'excalidraw-skill-portable-preview',
    fidelity: 'geometry-label-layout-review'
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`preview failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
