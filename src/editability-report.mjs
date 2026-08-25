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

function hasBoundElement(element, id, type) {
  return Array.isArray(element?.boundElements)
    && element.boundElements.some((item) => item?.id === id && item?.type === type);
}

export function createEditabilityReport(scene) {
  const elements = Array.isArray(scene?.elements) ? scene.elements : [];
  const nodes = elements.filter((element) => metaOf(element).role === 'node');
  const labels = elements.filter((element) => metaOf(element).role === 'label');
  const edges = elements.filter((element) => metaOf(element).role === 'edge');
  const frames = elements.filter((element) => metaOf(element).role === 'frame');
  const details = elements.filter((element) => metaOf(element).role === 'component-detail');
  const nodesBySemanticId = new Map(nodes.map((node) => [metaOf(node).semanticId, node]));
  const nodesByElementId = new Map(nodes.map((node) => [node.id, node]));
  const labelsByNode = new Map();

  for (const label of labels) {
    const nodeId = metaOf(label).node;
    const list = labelsByNode.get(nodeId) ?? [];
    list.push(label);
    labelsByNode.set(nodeId, list);
  }

  const unboundLabels = [];
  const missingLabelBackrefs = [];
  const missingNodeLabels = [];
  for (const node of nodes) {
    const semanticId = metaOf(node).semanticId;
    const nodeLabels = labelsByNode.get(semanticId) ?? [];
    if (nodeLabels.length === 0) {
      missingNodeLabels.push(semanticId);
      continue;
    }
    for (const label of nodeLabels) {
      if (label.containerId !== node.id) {
        unboundLabels.push({ node: semanticId, label: label.id, containerId: label.containerId ?? null });
      }
      if (!hasBoundElement(node, label.id, 'text')) {
        missingLabelBackrefs.push({ node: semanticId, label: label.id });
      }
    }
  }

  const invalidEdgeBindings = [];
  const missingEdgeBackrefs = [];
  for (const edge of edges) {
    const meta = metaOf(edge);
    const source = nodesBySemanticId.get(meta.from);
    const target = nodesBySemanticId.get(meta.to);
    const startId = edge.startBinding?.elementId ?? null;
    const endId = edge.endBinding?.elementId ?? null;
    if (!source || !target || startId !== source?.id || endId !== target?.id
      || !nodesByElementId.has(startId) || !nodesByElementId.has(endId)) {
      invalidEdgeBindings.push({
        edge: meta.semanticId,
        from: meta.from,
        to: meta.to,
        startBinding: startId,
        endBinding: endId
      });
      continue;
    }
    if (!hasBoundElement(source, edge.id, 'arrow')) {
      missingEdgeBackrefs.push({ edge: meta.semanticId, node: meta.from, endpoint: 'source' });
    }
    if (!hasBoundElement(target, edge.id, 'arrow')) {
      missingEdgeBackrefs.push({ edge: meta.semanticId, node: meta.to, endpoint: 'target' });
    }
  }

  const invalidFrameMembership = [];
  for (const frame of frames) {
    const meta = metaOf(frame);
    const expected = Number(meta.memberCount ?? 0);
    if (expected <= 0) continue;
    const members = nodes.filter((node) => node.frameId === frame.id);
    if (members.length < expected) {
      invalidFrameMembership.push({
        frame: meta.semanticId ?? frame.id,
        expected,
        actual: members.length
      });
    }
    for (const node of members) {
      const semanticId = metaOf(node).semanticId;
      for (const label of labelsByNode.get(semanticId) ?? []) {
        if (label.frameId !== frame.id) {
          invalidFrameMembership.push({
            frame: meta.semanticId ?? frame.id,
            node: semanticId,
            reason: 'bound-label-frame-mismatch'
          });
        }
      }
    }
  }

  const ungroupedComponentDetails = [];
  for (const detail of details) {
    const meta = metaOf(detail);
    const parent = nodesBySemanticId.get(meta.parentNode);
    const groups = Array.isArray(detail.groupIds) ? detail.groupIds : [];
    const parentGroups = Array.isArray(parent?.groupIds) ? parent.groupIds : [];
    const sharedGroup = groups.some((groupId) => parentGroups.includes(groupId));
    if (!parent || groups.length === 0 || !sharedGroup) {
      ungroupedComponentDetails.push({
        detail: detail.id,
        parentNode: meta.parentNode ?? null,
        groups
      });
    }
  }

  const metrics = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    frameCount: frames.length,
    componentDetailCount: details.length,
    missingNodeLabels: missingNodeLabels.length,
    unboundLabels: unboundLabels.length,
    missingLabelBackrefs: missingLabelBackrefs.length,
    invalidEdgeBindings: invalidEdgeBindings.length,
    missingEdgeBackrefs: missingEdgeBackrefs.length,
    invalidFrameMembership: invalidFrameMembership.length,
    ungroupedComponentDetails: ungroupedComponentDetails.length
  };
  const pass = missingNodeLabels.length === 0
    && unboundLabels.length === 0
    && missingLabelBackrefs.length === 0
    && invalidEdgeBindings.length === 0
    && missingEdgeBackrefs.length === 0
    && invalidFrameMembership.length === 0
    && ungroupedComponentDetails.length === 0;

  return {
    version: '0.1.0',
    pass,
    metrics,
    details: {
      missingNodeLabels,
      unboundLabels,
      missingLabelBackrefs,
      invalidEdgeBindings,
      missingEdgeBackrefs,
      invalidFrameMembership,
      ungroupedComponentDetails
    }
  };
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/editability-report.mjs <scene.excalidraw> [-o report.json]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : `${scenePath}.editability.json`;
  const report = createEditabilityReport(readJson(scenePath));
  writeJson(outputPath, report);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), outputPath) || outputPath,
    pass: report.pass,
    metrics: report.metrics
  }, null, 2));
  process.exit(report.pass ? 0 : 1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
