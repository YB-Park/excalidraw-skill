#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitEdgeLabel } from './edge-label-fit.mjs';
import { edgeLabelStyle, presetNameForScene } from './style-preset.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function safeId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function makeLabel(edge, fitOptions = {}, style) {
  const meta = edge.customData?.excalidrawSkill;
  const fitted = fitEdgeLabel(meta.label, edge, {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    ...fitOptions
  });
  return {
    id: safeId('text', `${meta.semanticId}_label`),
    type: 'text',
    x: edge.x + edge.width / 2 - fitted.width / 2,
    y: edge.y + edge.height / 2 - fitted.height / 2,
    width: fitted.width,
    height: fitted.height,
    angle: 0,
    strokeColor: style.strokeColor,
    backgroundColor: style.initialBackgroundColor,
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0.7,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    text: fitted.text,
    originalText: fitted.originalText,
    fontSize: fitted.fontSize,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    containerId: null,
    lineHeight: fitted.lineHeight,
    customData: {
      excalidrawSkill: {
        semanticId: `${meta.semanticId}_label`,
        role: 'edge-label',
        edge: meta.semanticId,
        fit: {
          version: '0.2.0',
          lineCount: fitted.lineCount,
          preferredMaxWidth: fitted.preferredMaxWidth,
          estimatedLineWidths: fitted.estimatedLineWidths
        }
      }
    }
  };
}

export function labelEdges(scene) {
  const style = edgeLabelStyle(presetNameForScene(scene));
  const layout = scene.customData?.excalidrawSkill?.layout;
  const fitOptions = layout?.family === 'module-architecture' && layout?.strategy === 'hub-grid'
    ? { maxWidth: 96 }
    : {};
  const existing = new Set();
  for (const element of scene.elements ?? []) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'edge-label') existing.add(meta.edge);
  }

  for (const element of [...(scene.elements ?? [])]) {
    const meta = element.customData?.excalidrawSkill;
    if (meta?.role === 'edge' && meta.label && !existing.has(meta.semanticId)) {
      scene.elements.push(makeLabel(element, fitOptions, style));
      existing.add(meta.semanticId);
    }
  }
  return scene;
}

function main() {
  const [scenePath, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePath) {
    console.error('Usage: node src/label-edges.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }

  const scene = labelEdges(readJson(scenePath));
  const outputPath = flag === '-o' && outputPathArg ? outputPathArg : scenePath;
  writeJson(outputPath, scene);
  console.log(outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`label-edges failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
