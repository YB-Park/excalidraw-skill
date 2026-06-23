#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULTS = Object.freeze({
  originX: 120,
  originY: 120,
  rankGap: 120,
  swimlaneVerticalRankGap: 96,
  laneGap: 110,
  slotGap: 34
});

const FLOW_TYPES = new Set([
  'flow',
  'service-flow',
  'event-flow',
  'data-flow'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function semanticMeta(element) {
  return element?.customData?.excalidrawSkill ?? null;
}

function collectSceneNodes(scene) {
  const nodes = new Map();
  for (const element of scene.elements ?? []) {
    const meta = semanticMeta(element);
    if (meta?.role === 'node' && typeof meta.semanticId === 'string') {
      nodes.set(meta.semanticId, element);
    }
  }
  return nodes;
}

function collectLabels(scene) {
  const labels = new Map();
  for (const element of scene.elements ?? []) {
    const meta = semanticMeta(element);
    if (meta?.role !== 'label' || typeof meta.node !== 'string') continue;
    const list = labels.get(meta.node) ?? [];
    list.push(element);
    labels.set(meta.node, list);
  }
  return labels;
}

function nodeIndex(spec) {
  return new Map((spec.nodes ?? []).map((node, index) => [node.semanticId, { node, index }]));
}

function edgeDegree(spec) {
  const degree = new Map();
  for (const edge of spec.edges ?? []) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return degree;
}

function lanePositionWeight(position) {
  return ({ top: 0, left: 0, center: 1, right: 2, bottom: 2 })[position] ?? 1;
}

function normalizedLanes(spec) {
  const declared = Array.isArray(spec.layout?.lanes) ? spec.layout.lanes : [];
  const used = new Set((spec.nodes ?? []).map((node) => node.layoutHints?.lane).filter(Boolean));
  const lanes = declared
    .filter((lane) => lane && typeof lane.id === 'string')
    .map((lane, index) => ({
      id: lane.id,
      label: lane.label ?? lane.id,
      position: lane.position ?? 'center',
      order: finite(lane.order, index)
    }));

  for (const laneId of used) {
    if (!lanes.some((lane) => lane.id === laneId)) {
      lanes.push({ id: laneId, label: laneId, position: 'bottom', order: lanes.length });
    }
  }

  if (lanes.length === 0) {
    lanes.push({ id: 'main', label: 'main', position: 'center', order: 0 });
  }

  return lanes.sort((a, b) => {
    return lanePositionWeight(a.position) - lanePositionWeight(b.position) || a.order - b.order || a.id.localeCompare(b.id);
  });
}

function orderedPrimary(spec, index) {
  const explicit = Array.isArray(spec.layout?.primaryFlow) ? spec.layout.primaryFlow : [];
  const valid = explicit.filter((id) => index.has(id));
  if (valid.length > 0) return valid;

  return [...index.values()]
    .filter(({ node }) => node.layoutHints?.importance === 'primary')
    .sort((a, b) => finite(a.node.layoutHints?.rank, a.index) - finite(b.node.layoutHints?.rank, b.index))
    .map(({ node }) => node.semanticId);
}

function nodeRank(node, index, primaryRank) {
  const explicit = node.layoutHints?.rank;
  if (Number.isFinite(explicit)) return explicit;
  if (primaryRank.has(node.semanticId)) return primaryRank.get(node.semanticId);
  return index;
}

function normalizedRanks(entries, primaryRank) {
  const ranks = new Map();
  for (const entry of entries) ranks.set(entry.node.semanticId, nodeRank(entry.node, entry.index, primaryRank));
  const base = Math.min(...ranks.values());
  if (!Number.isFinite(base)) return ranks;
  for (const [id, rank] of ranks) ranks.set(id, rank - base);
  return ranks;
}

function rankGapFor(spec) {
  const ratio = spec.layout?.aspectRatio ?? 'balanced';
  if (ratio === 'wide') return 160;
  if (ratio === 'tall') return 90;
  return DEFAULTS.rankGap;
}

function swimlaneVerticalRankGapFor(spec) {
  const ratio = spec.layout?.aspectRatio ?? 'balanced';
  if (ratio === 'wide') return 108;
  if (ratio === 'tall') return 78;
  return DEFAULTS.swimlaneVerticalRankGap;
}

function placementGeometry(sceneNodes, spec) {
  const widths = [...sceneNodes.values()].map((node) => finite(node.width, 180));
  const heights = [...sceneNodes.values()].map((node) => finite(node.height, 80));
  const maxWidth = Math.max(180, ...widths);
  const maxHeight = Math.max(80, ...heights);
  const ratio = spec.layout?.aspectRatio ?? 'balanced';
  const laneGap = ratio === 'tall' ? 150 : ratio === 'wide' ? 90 : DEFAULTS.laneGap;
  return { maxWidth, maxHeight, rankPitch: maxWidth + rankGapFor(spec), laneGap };
}

function setPosition(placements, id, x, y) {
  if (!placements.has(id)) placements.set(id, { x: Math.round(x), y: Math.round(y) });
}

function layoutLayered(spec, sceneNodes) {
  const index = nodeIndex(spec);
  const primary = orderedPrimary(spec, index);
  const primaryRank = new Map(primary.map((id, position) => [id, position]));
  const { maxHeight, rankPitch, laneGap } = placementGeometry(sceneNodes, spec);
  const direction = spec.layout?.direction ?? 'left-to-right';
  const placements = new Map();
  const entries = [...index.values()];
  const ranks = normalizedRanks(entries, primaryRank);
  const laneById = new Map(normalizedLanes(spec).map((lane) => [lane.id, lane]));
  const remaining = entries.filter(({ node }) => !primaryRank.has(node.semanticId));
  const upperIds = new Set(remaining.filter(({ node }) => {
    const position = laneById.get(node.layoutHints?.lane)?.position;
    return position === 'top' || position === 'left' || (!position && node.layoutHints?.importance === 'secondary');
  }).map(({ node }) => node.semanticId));
  const upper = remaining.filter(({ node }) => upperIds.has(node.semanticId));
  const lower = remaining.filter(({ node }) => !upperIds.has(node.semanticId));

  function placeRow(rowEntries, cross, startSlot = 0) {
    const byRank = new Map();
    for (const entry of rowEntries) {
      const rank = ranks.get(entry.node.semanticId) ?? entry.index;
      const group = byRank.get(rank) ?? [];
      group.push(entry);
      byRank.set(rank, group);
    }
    for (const [rank, group] of byRank) {
      group.sort((a, b) => a.index - b.index);
      group.forEach(({ node }, slot) => {
        if (direction === 'top-to-bottom') {
          setPosition(placements, node.semanticId, cross + (startSlot + slot) * (180 + DEFAULTS.slotGap), DEFAULTS.originY + rank * rankPitch);
        } else {
          setPosition(placements, node.semanticId, DEFAULTS.originX + rank * rankPitch, cross + (startSlot + slot) * (maxHeight + DEFAULTS.slotGap));
        }
      });
    }
  }

  primary.forEach((id) => {
    const rank = ranks.get(id) ?? primaryRank.get(id) ?? 0;
    if (direction === 'top-to-bottom') setPosition(placements, id, 460, DEFAULTS.originY + rank * rankPitch);
    else setPosition(placements, id, DEFAULTS.originX + rank * rankPitch, 280);
  });

  if (direction === 'top-to-bottom') {
    placeRow(upper, DEFAULTS.originX);
    placeRow(lower, 460 + 180 + laneGap);
  } else {
    placeRow(upper, DEFAULTS.originY);
    placeRow(lower, 280 + maxHeight + laneGap);
  }

  return placements;
}

function groupWidth(group, sceneNodes) {
  return group.reduce((sum, entry, index) => {
    const node = sceneNodes.get(entry.node.semanticId);
    return sum + finite(node?.width, 180) + (index === 0 ? 0 : DEFAULTS.slotGap);
  }, 0);
}

function groupHeight(group, sceneNodes) {
  return group.reduce((sum, entry, index) => {
    const node = sceneNodes.get(entry.node.semanticId);
    return sum + finite(node?.height, 80) + (index === 0 ? 0 : DEFAULTS.slotGap);
  }, 0);
}

function placeCenteredHorizontalGroup(placements, group, sceneNodes, laneCenterX, y) {
  let x = laneCenterX - groupWidth(group, sceneNodes) / 2;
  for (const { node } of group) {
    const sceneNode = sceneNodes.get(node.semanticId);
    const width = finite(sceneNode?.width, 180);
    setPosition(placements, node.semanticId, x, y);
    x += width + DEFAULTS.slotGap;
  }
}

function placeCenteredVerticalGroup(placements, group, sceneNodes, x, laneCenterY) {
  let y = laneCenterY - groupHeight(group, sceneNodes) / 2;
  for (const { node } of group) {
    const sceneNode = sceneNodes.get(node.semanticId);
    const height = finite(sceneNode?.height, 80);
    setPosition(placements, node.semanticId, x, y);
    y += height + DEFAULTS.slotGap;
  }
}

function layoutSwimlanes(spec, sceneNodes) {
  const index = nodeIndex(spec);
  const lanes = normalizedLanes(spec);
  const primary = orderedPrimary(spec, index);
  const primaryRank = new Map(primary.map((id, position) => [id, position]));
  const { maxWidth, maxHeight, rankPitch, laneGap } = placementGeometry(sceneNodes, spec);
  const direction = spec.layout?.direction ?? 'left-to-right';
  const placements = new Map();
  const ranks = normalizedRanks([...index.values()], primaryRank);
  const laneEntries = new Map(lanes.map((lane) => [lane.id, []]));
  const defaultLane = lanes.find((lane) => lane.position === 'center')?.id ?? lanes[0].id;
  const swimlaneRankPitch = direction === 'top-to-bottom'
    ? maxHeight + swimlaneVerticalRankGapFor(spec)
    : rankPitch;

  for (const entry of index.values()) {
    const laneId = entry.node.layoutHints?.lane ?? (primaryRank.has(entry.node.semanticId) ? defaultLane : lanes.at(-1).id);
    const targetLane = laneEntries.has(laneId) ? laneId : defaultLane;
    laneEntries.get(targetLane).push(entry);
  }

  const laneSizes = new Map();
  for (const lane of lanes) {
    const groups = new Map();
    for (const entry of laneEntries.get(lane.id)) {
      const rank = ranks.get(entry.node.semanticId) ?? entry.index;
      const group = groups.get(rank) ?? [];
      group.push(entry);
      groups.set(rank, group);
    }
    const maxSlots = Math.max(1, ...[...groups.values()].map((group) => group.length));
    laneSizes.set(lane.id, direction === 'top-to-bottom'
      ? maxSlots * maxWidth + (maxSlots - 1) * DEFAULTS.slotGap
      : maxSlots * maxHeight + (maxSlots - 1) * DEFAULTS.slotGap);
  }

  let cross = direction === 'top-to-bottom' ? DEFAULTS.originX : DEFAULTS.originY;
  for (const lane of lanes) {
    const entries = laneEntries.get(lane.id);
    const groups = new Map();
    for (const entry of entries) {
      const rank = ranks.get(entry.node.semanticId) ?? entry.index;
      const group = groups.get(rank) ?? [];
      group.push(entry);
      groups.set(rank, group);
    }

    const laneCenter = cross + laneSizes.get(lane.id) / 2;
    for (const [rank, group] of groups) {
      group.sort((a, b) => {
        const ai = a.node.layoutHints?.importance === 'primary' ? 0 : a.node.layoutHints?.importance === 'secondary' ? 1 : 2;
        const bi = b.node.layoutHints?.importance === 'primary' ? 0 : b.node.layoutHints?.importance === 'secondary' ? 1 : 2;
        return ai - bi || a.index - b.index;
      });
      if (direction === 'top-to-bottom') {
        placeCenteredHorizontalGroup(placements, group, sceneNodes, laneCenter, DEFAULTS.originY + rank * swimlaneRankPitch);
      } else {
        placeCenteredVerticalGroup(placements, group, sceneNodes, DEFAULTS.originX + rank * swimlaneRankPitch, laneCenter);
      }
    }
    cross += laneSizes.get(lane.id) + laneGap;
  }

  return placements;
}

function classifyHubNode(node) {
  const shape = String(node.shapeRef ?? node.kind ?? '').toLowerCase();
  const group = String(node.group ?? '').toLowerCase();
  const lane = String(node.layoutHints?.lane ?? '').toLowerCase();
  if (lane === 'left' || lane === 'right' || lane === 'top' || lane === 'bottom') return lane;
  if (shape.includes('external') || group.includes('external') || shape.includes('provider')) return 'right';
  if (shape.includes('database') || shape.includes('storage') || shape.includes('queue') || node.layoutHints?.importance === 'support') return 'bottom';
  return 'left';
}

function layoutHub(spec, sceneNodes) {
  const index = nodeIndex(spec);
  const degree = edgeDegree(spec);
  const primary = orderedPrimary(spec, index);
  const hubId = primary[0] ?? [...index.values()]
    .sort((a, b) => (degree.get(b.node.semanticId) ?? 0) - (degree.get(a.node.semanticId) ?? 0) || a.index - b.index)[0]?.node.semanticId;
  const placements = new Map();
  if (!hubId) return placements;

  const hub = sceneNodes.get(hubId);
  const hubWidth = finite(hub?.width, 180);
  const hubHeight = finite(hub?.height, 80);
  const centerX = 560;
  const centerY = 330;
  setPosition(placements, hubId, centerX, centerY);

  const buckets = { left: [], right: [], top: [], bottom: [] };
  for (const entry of index.values()) {
    if (entry.node.semanticId === hubId) continue;
    buckets[classifyHubNode(entry.node)].push(entry);
  }
  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => finite(a.node.layoutHints?.rank, a.index) - finite(b.node.layoutHints?.rank, b.index) || a.index - b.index);
  }

  function stackVertical(entries, x, center) {
    const pitch = 130;
    const start = center - ((entries.length - 1) * pitch) / 2;
    entries.forEach(({ node }, slot) => setPosition(placements, node.semanticId, x, start + slot * pitch));
  }

  function stackHorizontal(entries, y, center) {
    const pitch = 250;
    const start = center - ((entries.length - 1) * pitch) / 2;
    entries.forEach(({ node }, slot) => setPosition(placements, node.semanticId, start + slot * pitch, y));
  }

  stackVertical(buckets.left, centerX - 360, centerY);
  stackVertical(buckets.right, centerX + hubWidth + 180, centerY);
  stackHorizontal(buckets.top, centerY - hubHeight - 180, centerX);
  stackHorizontal(buckets.bottom, centerY + hubHeight + 180, centerX);
  return placements;
}

function applyPlacements(scene, sceneNodes, labels, placements, spec, profile) {
  for (const [id, target] of placements) {
    const node = sceneNodes.get(id);
    if (!node) continue;
    const dx = target.x - finite(node.x, 0);
    const dy = target.y - finite(node.y, 0);
    node.x = target.x;
    node.y = target.y;
    for (const label of labels.get(id) ?? []) {
      label.x = finite(label.x, 0) + dx;
      label.y = finite(label.y, 0) + dy;
    }
  }

  scene.customData ??= {};
  scene.customData.excalidrawSkill ??= {};
  scene.customData.excalidrawSkill.layout = {
    engine: 'flow-v0.4.1',
    family: 'flow',
    subtype: spec.diagramType,
    profile,
    placedNodes: placements.size
  };
}

export function layoutServiceFlow(scene, spec) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene JSON must be an object');
  if (!spec || typeof spec !== 'object') throw new TypeError('DiagramSpec JSON must be an object');
  if (!FLOW_TYPES.has(spec.diagramType)) return scene;

  const sceneNodes = collectSceneNodes(scene);
  const labels = collectLabels(scene);
  const profile = spec.layout?.profile ?? (spec.version === '2.0' ? 'layered-flow' : null);
  if (!profile) return scene;

  let placements;
  if (profile === 'swimlane-flow') placements = layoutSwimlanes(spec, sceneNodes);
  else if (profile === 'hub-and-spoke') placements = layoutHub(spec, sceneNodes);
  else placements = layoutLayered(spec, sceneNodes);

  applyPlacements(scene, sceneNodes, labels, placements, spec, profile);
  return scene;
}

export const layoutFlow = layoutServiceFlow;

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg || !specPathArg) {
    console.error('Usage: node src/layout-service-flow.mjs <scene.excalidraw> <spec.json> [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = path.resolve(process.cwd(), specPathArg);
  const outputPath = flag === '-o' && outputPathArg ? path.resolve(process.cwd(), outputPathArg) : scenePath;
  const scene = layoutServiceFlow(readJson(scenePath), readJson(specPath));
  writeJson(outputPath, scene);
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`layout-service-flow failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
