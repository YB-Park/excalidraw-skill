#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function safeId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function center(element) {
  return {
    x: Number(element.x ?? 0) + Number(element.width ?? 0) / 2,
    y: Number(element.y ?? 0) + Number(element.height ?? 0) / 2
  };
}

function distanceSquared(first, second) {
  const a = center(first);
  const b = center(second);
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function addGroup(element, groupId) {
  const groups = Array.isArray(element.groupIds) ? element.groupIds : [];
  if (!groups.includes(groupId)) groups.push(groupId);
  element.groupIds = groups;
}

export function groupComponentDetails(scene) {
  const elements = scene?.elements ?? [];
  const nodes = elements.filter((element) => metaOf(element).role === 'node');
  const details = elements.filter((element) => metaOf(element).role === 'component-detail');
  if (nodes.length === 0 || details.length === 0) return scene;

  const groupByNodeId = new Map();
  for (const node of nodes) {
    const semanticId = metaOf(node).semanticId;
    const groupId = safeId('group_component', semanticId);
    groupByNodeId.set(semanticId, groupId);
    addGroup(node, groupId);
    for (const element of elements) {
      const meta = metaOf(element);
      if (meta.role === 'label' && meta.node === semanticId) addGroup(element, groupId);
    }
  }

  for (const detail of details) {
    const owner = nodes
      .map((node) => ({ node, distance: distanceSquared(detail, node) }))
      .sort((a, b) => a.distance - b.distance)[0]?.node;
    if (!owner) continue;
    const ownerId = metaOf(owner).semanticId;
    const groupId = groupByNodeId.get(ownerId);
    addGroup(detail, groupId);
    detail.customData.excalidrawSkill.parentNode = ownerId;
  }

  return scene;
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/group-component-details.mjs <scene.excalidraw> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  writeJson(outputPath, groupComponentDetails(readJson(scenePath)));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
