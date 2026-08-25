#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function findWarnings(scene, nodes, edges, labels) {
  const warnings = [];
  const nodeByElementId = new Map(nodes.map((node) => [node.elementId, node]));

  for (const label of labels) {
    if (!label.containerId) warnings.push({ code: 'unbound-node-label', node: metaOf(label).node ?? null });
  }

  for (const edge of edges) {
    if (!edge.startBinding || !edge.endBinding) {
      warnings.push({ code: 'unbound-edge', edge: metaOf(edge).semanticId ?? edge.id });
      continue;
    }
    if (!nodeByElementId.has(edge.startBinding.elementId) || !nodeByElementId.has(edge.endBinding.elementId)) {
      warnings.push({ code: 'edge-binding-target-missing', edge: metaOf(edge).semanticId ?? edge.id });
    }
  }

  return warnings;
}

export function inspectScene(scene, sceneTitle = 'diagram.excalidraw') {
  const metadata = scene?.customData?.excalidrawSkill ?? {};
  const nodes = [];
  const rawEdges = [];
  const labels = [];
  const frames = [];

  for (const element of scene?.elements ?? []) {
    const data = metaOf(element);
    if (data.role === 'node') {
      nodes.push({
        semanticId: data.semanticId,
        label: data.label ?? data.displayLabel ?? data.semanticId,
        shapeRef: data.shapeRef ?? null,
        frameId: element.frameId ?? null,
        positionHint: { x: Number(element.x ?? 0), y: Number(element.y ?? 0) },
        manualLayout: data.manualLayout === true,
        elementId: element.id
      });
    }
    if (data.role === 'edge') rawEdges.push(element);
    if (data.role === 'label') labels.push(element);
    if (data.role === 'frame') {
      frames.push({
        semanticId: data.semanticId ?? element.id,
        label: element.name ?? data.label ?? data.semanticId ?? element.id,
        memberCount: Number(data.memberCount ?? 0),
        boundaryIntent: data.boundaryIntent ?? null
      });
    }
  }

  const edges = rawEdges.map((element) => {
    const data = metaOf(element);
    return {
      semanticId: data.semanticId,
      from: data.from,
      to: data.to,
      label: data.label ?? '',
      kind: data.kind ?? 'sync'
    };
  });

  const warnings = findWarnings(scene, nodes, rawEdges, labels);

  return {
    sceneTitle,
    diagramType: metadata.diagramType ?? metadata.layout?.family ?? null,
    stylePreset: metadata.stylePreset ?? null,
    nodes: nodes.map(({ elementId, ...node }) => node),
    edges,
    frames,
    warnings
  };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node src/inspect-scene.mjs <scene.excalidraw>');
    process.exit(1);
  }
  const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(inspectScene(scene, path.basename(file)), null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
