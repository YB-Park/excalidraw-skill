#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collinearOverlapLength,
  polylineLength,
  rectOf,
  segmentIntersectsRect,
  segmentsFromPoints,
  segmentsIntersect
} from './geometry.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function center(element) {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function metaOf(element) {
  return element.customData?.excalidrawSkill ?? {};
}

function sideFor(from, to, hint = 'auto') {
  if (['right', 'left', 'up', 'down'].includes(hint)) return hint;
  const source = center(from);
  const target = center(to);
  if (Math.abs(target.x - source.x) >= Math.abs(target.y - source.y)) {
    return target.x >= source.x ? 'right' : 'left';
  }
  return target.y >= source.y ? 'down' : 'up';
}

function opposite(side) {
  return ({ right: 'left', left: 'right', up: 'down', down: 'up' })[side];
}

function perpendicularSides(side) {
  return side === 'up' || side === 'down'
    ? ['left', 'right']
    : ['up', 'down'];
}

function anchor(node, side, offset = 0) {
  if (side === 'right') {
    return {
      x: node.x + node.width,
      y: clamp(node.y + node.height / 2 + offset, node.y + 12, node.y + node.height - 12)
    };
  }
  if (side === 'left') {
    return {
      x: node.x,
      y: clamp(node.y + node.height / 2 + offset, node.y + 12, node.y + node.height - 12)
    };
  }
  if (side === 'down') {
    return {
      x: clamp(node.x + node.width / 2 + offset, node.x + 12, node.x + node.width - 12),
      y: node.y + node.height
    };
  }
  return {
    x: clamp(node.x + node.width / 2 + offset, node.x + 12, node.x + node.width - 12),
    y: node.y
  };
}

function dedupe(points) {
  return points.filter((point, index) => {
    return index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y;
  });
}

function sceneBounds(nodes) {
  const values = [...nodes.values()];
  return {
    left: Math.min(...values.map((node) => node.x)),
    right: Math.max(...values.map((node) => node.x + node.width)),
    top: Math.min(...values.map((node) => node.y)),
    bottom: Math.max(...values.map((node) => node.y + node.height))
  };
}

function pointOutward(point, side, distance) {
  if (side === 'right') return { x: point.x + distance, y: point.y };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  if (side === 'down') return { x: point.x, y: point.y + distance };
  return { x: point.x, y: point.y - distance };
}

function faceAligned(start, end, sourceSide, targetSide) {
  if ((sourceSide === 'down' && targetSide === 'up') || (sourceSide === 'up' && targetSide === 'down')) {
    return Math.abs(start.x - end.x) < 1e-9;
  }
  if ((sourceSide === 'right' && targetSide === 'left') || (sourceSide === 'left' && targetSide === 'right')) {
    return Math.abs(start.y - end.y) < 1e-9;
  }
  return false;
}

function candidates(start, end, sourceSide, targetSide, bounds, laneOffset) {
  const result = [];
  const clearance = 36 + Math.abs(laneOffset);
  const startStub = pointOutward(start, sourceSide, clearance);
  const endStub = pointOutward(end, targetSide, clearance);

  if (faceAligned(start, end, sourceSide, targetSide)) result.push([start, end]);

  const sourceVertical = sourceSide === 'up' || sourceSide === 'down';
  const targetVertical = targetSide === 'up' || targetSide === 'down';
  if (sourceVertical && targetVertical) {
    const middleY = (start.y + end.y) / 2 + laneOffset;
    result.push(dedupe([
      start,
      { x: start.x, y: middleY },
      { x: end.x, y: middleY },
      end
    ]));
    for (const bypassX of [
      bounds.left - 70 - Math.abs(laneOffset),
      bounds.right + 70 + Math.abs(laneOffset)
    ]) {
      result.push(dedupe([
        start,
        startStub,
        { x: bypassX, y: startStub.y },
        { x: bypassX, y: endStub.y },
        endStub,
        end
      ]));
    }
  } else if (!sourceVertical && !targetVertical) {
    const middleX = (start.x + end.x) / 2 + laneOffset;
    result.push(dedupe([
      start,
      { x: middleX, y: start.y },
      { x: middleX, y: end.y },
      end
    ]));
    for (const bypassY of [
      bounds.top - 70 - Math.abs(laneOffset),
      bounds.bottom + 70 + Math.abs(laneOffset)
    ]) {
      result.push(dedupe([
        start,
        startStub,
        { x: startStub.x, y: bypassY },
        { x: endStub.x, y: bypassY },
        endStub,
        end
      ]));
    }
  } else if (sourceVertical) {
    result.push(dedupe([
      start,
      startStub,
      { x: endStub.x, y: startStub.y },
      endStub,
      end
    ]));
  } else {
    result.push(dedupe([
      start,
      startStub,
      { x: startStub.x, y: endStub.y },
      endStub,
      end
    ]));
  }
  return result;
}

function approachProbeEnd(end, side, source, bounds) {
  const sourceCenter = center(source);
  if (side === 'up') {
    return { x: end.x, y: Math.min(sourceCenter.y, bounds.top - 70) };
  }
  if (side === 'down') {
    return { x: end.x, y: Math.max(sourceCenter.y, bounds.bottom + 70) };
  }
  if (side === 'left') {
    return { x: Math.min(sourceCenter.x, bounds.left - 70), y: end.y };
  }
  return { x: Math.max(sourceCenter.x, bounds.right + 70), y: end.y };
}

function approachBlocked(end, side, source, obstacles, bounds) {
  const probe = {
    a: end,
    b: approachProbeEnd(end, side, source, bounds)
  };
  return obstacles.some((rect) => segmentIntersectsRect(probe, rect));
}

function scoreRoute(points, obstacles, existingSegments, sidePenalty = 0, approachPenalty = 0) {
  const segments = segmentsFromPoints(points);
  let nodeHits = 0;
  let crossings = 0;
  let overlapLength = 0;
  for (const segment of segments) {
    nodeHits += obstacles.filter((rect) => segmentIntersectsRect(segment, rect)).length;
    for (const other of existingSegments) {
      if (segmentsIntersect(segment, other, { includeEndpoints: false })) crossings += 1;
      overlapLength += collinearOverlapLength(segment, other);
    }
  }
  return [
    nodeHits,
    approachPenalty,
    sidePenalty,
    overlapLength > 8 ? 1 : 0,
    overlapLength,
    crossings,
    Math.max(0, points.length - 2),
    polylineLength(points)
  ];
}

function compareScore(first, second) {
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    const delta = (first[index] ?? 0) - (second[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function edgeSpecMap(spec) {
  return new Map((spec?.edges ?? []).map((edge) => [
    edge.semanticId ?? `${edge.from}_to_${edge.to}`,
    edge
  ]));
}

function nodeSpecMap(spec) {
  return new Map((spec?.nodes ?? []).map((node) => [node.semanticId, node]));
}

function primaryPairs(spec) {
  const ids = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let index = 0; index < ids.length - 1; index += 1) {
    pairs.add(`${ids[index]}->${ids[index + 1]}`);
  }
  return pairs;
}

function explicitDirection(edgeSpec) {
  const direction = edgeSpec?.routeHints?.direction;
  return ['right', 'left', 'up', 'down'].includes(direction) ? direction : null;
}

function alignmentTolerance(sizeA, sizeB) {
  return Math.max(24, Math.min(sizeA, sizeB) * 0.25);
}

function axisAlignment(from, to) {
  const source = center(from);
  const target = center(to);
  const dx = Math.abs(target.x - source.x);
  const dy = Math.abs(target.y - source.y);
  return {
    dx,
    dy,
    sameColumn: dx <= alignmentTolerance(from.width, to.width),
    sameRow: dy <= alignmentTolerance(from.height, to.height)
  };
}

function isLayeredSystem(spec) {
  return spec?.diagramType === 'system-architecture'
    && (spec.layout?.profile ?? 'layered-system') === 'layered-system';
}

function axisLockedSides(from, to, spec, fromSpec, toSpec) {
  const alignment = axisAlignment(from, to);
  const source = center(from);
  const target = center(to);
  const layeredRankEdge = isLayeredSystem(spec)
    && fromSpec?.layer
    && toSpec?.layer
    && fromSpec.layer !== toSpec.layer;

  if (alignment.sameColumn && target.y !== source.y && (layeredRankEdge || alignment.dy >= alignment.dx)) {
    const sourceSide = target.y >= source.y ? 'down' : 'up';
    return {
      sourceSide,
      targetSide: opposite(sourceSide),
      preferTargetSide: true,
      axisLock: 'vertical'
    };
  }

  if (alignment.sameRow && target.x !== source.x && (!layeredRankEdge || alignment.dx >= alignment.dy)) {
    const sourceSide = target.x >= source.x ? 'right' : 'left';
    return {
      sourceSide,
      targetSide: opposite(sourceSide),
      preferTargetSide: true,
      axisLock: 'horizontal'
    };
  }

  return null;
}

function sidesForEdge(from, to, edgeSpec, spec, nodeSpecs, meta) {
  const direction = explicitDirection(edgeSpec);
  if (direction) {
    return {
      sourceSide: sideFor(from, to, direction),
      targetSide: opposite(sideFor(from, to, direction)),
      preferTargetSide: false,
      axisLock: null
    };
  }

  const lockedSides = axisLockedSides(
    from,
    to,
    spec,
    nodeSpecs.get(meta.from),
    nodeSpecs.get(meta.to)
  );
  if (lockedSides) return lockedSides;

  const sourceSide = sideFor(from, to);
  return {
    sourceSide,
    targetSide: opposite(sourceSide),
    preferTargetSide: false,
    axisLock: null
  };
}

function alignedForPorts(from, to, sides) {
  const alignment = axisAlignment(from, to);
  return (['up', 'down'].includes(sides.sourceSide) && alignment.sameColumn)
    || (['left', 'right'].includes(sides.sourceSide) && alignment.sameRow);
}

function unifiedPortOffsets(edges, nodes, specs, spec, nodeSpecs) {
  const groups = new Map();
  const edgeSides = new Map();
  for (const edge of edges) {
    const meta = metaOf(edge);
    const from = nodes.get(meta.from);
    const to = nodes.get(meta.to);
    if (!from || !to) continue;
    const sides = sidesForEdge(from, to, specs.get(meta.semanticId), spec, nodeSpecs, meta);
    edgeSides.set(edge.id, sides);
    for (const endpoint of [
      { nodeId: meta.from, side: sides.sourceSide, end: 'start', other: to },
      { nodeId: meta.to, side: sides.targetSide, end: 'end', other: from }
    ]) {
      const key = `${endpoint.nodeId}:${endpoint.side}`;
      const list = groups.get(key) ?? [];
      list.push({ edge, ...endpoint });
      groups.set(key, list);
    }
  }

  const offsets = new Map();
  const used = new Map();
  for (const [key, list] of groups) {
    const side = key.slice(key.lastIndexOf(':') + 1);
    const verticalSide = side === 'left' || side === 'right';
    list.sort((first, second) => {
      const firstCenter = center(first.other);
      const secondCenter = center(second.other);
      return (verticalSide
        ? firstCenter.y - secondCenter.y
        : firstCenter.x - secondCenter.x)
        || metaOf(first.edge).semanticId.localeCompare(metaOf(second.edge).semanticId);
    });
    list.forEach((item, index) => {
      const offset = (index - (list.length - 1) / 2) * 16;
      const current = offsets.get(item.edge.id) ?? { start: 0, end: 0 };
      current[item.end] = offset;
      offsets.set(item.edge.id, current);
    });
    used.set(key, new Set(list.map((_, index) => {
      return (index - (list.length - 1) / 2) * 16;
    })));
  }

  for (const edge of edges) {
    const meta = metaOf(edge);
    const from = nodes.get(meta.from);
    const to = nodes.get(meta.to);
    const sides = edgeSides.get(edge.id);
    if (!from || !to || !sides || !alignedForPorts(from, to, sides)) continue;
    const current = offsets.get(edge.id) ?? { start: 0, end: 0 };
    const startKey = `${meta.from}:${sides.sourceSide}`;
    const endKey = `${meta.to}:${sides.targetSide}`;
    const startUsed = used.get(startKey) ?? new Set();
    const endUsed = used.get(endKey) ?? new Set();
    const candidates = [current.start, current.end, 0]
      .filter((value, index, array) => array.indexOf(value) === index);
    const chosen = candidates.find((value) => {
      return (value === current.start || !startUsed.has(value))
        && (value === current.end || !endUsed.has(value));
    });
    if (chosen !== undefined) {
      current.start = chosen;
      current.end = chosen;
      offsets.set(edge.id, current);
    }
  }
  return { offsets, edgeSides };
}

export function routeEdges(scene, spec = null) {
  const nodes = new Map();
  const edges = [];
  for (const element of scene.elements ?? []) {
    const meta = metaOf(element);
    if (meta.role === 'node') nodes.set(meta.semanticId, element);
    if (meta.role === 'edge') edges.push(element);
  }
  if (nodes.size === 0) return scene;

  const specs = edgeSpecMap(spec);
  const nodeSpecs = nodeSpecMap(spec);
  const primary = primaryPairs(spec);
  const { offsets, edgeSides } = unifiedPortOffsets(edges, nodes, specs, spec, nodeSpecs);
  const bounds = sceneBounds(nodes);

  edges.sort((first, second) => {
    const firstMeta = metaOf(first);
    const secondMeta = metaOf(second);
    const firstPriority = specs.get(firstMeta.semanticId)?.routeHints?.priority === 'primary'
      || primary.has(`${firstMeta.from}->${firstMeta.to}`)
      ? 0
      : 1;
    const secondPriority = specs.get(secondMeta.semanticId)?.routeHints?.priority === 'primary'
      || primary.has(`${secondMeta.from}->${secondMeta.to}`)
      ? 0
      : 1;
    return firstPriority - secondPriority
      || firstMeta.semanticId.localeCompare(secondMeta.semanticId);
  });

  const existingSegments = [];
  const channelUsage = new Map();
  for (const edge of edges) {
    const meta = metaOf(edge);
    const from = nodes.get(meta.from);
    const to = nodes.get(meta.to);
    if (!from || !to) continue;

    const sides = edgeSides.get(edge.id) ?? sidesForEdge(
      from,
      to,
      specs.get(meta.semanticId),
      spec,
      nodeSpecs,
      meta
    );
    const port = offsets.get(edge.id) ?? { start: 0, end: 0 };
    const start = anchor(from, sides.sourceSide, port.start);
    const preferredEnd = anchor(to, sides.targetSide, port.end);
    const channelKey = `${sides.sourceSide}:${Math.round((
      ['right', 'left'].includes(sides.sourceSide)
        ? (start.x + preferredEnd.x) / 2
        : (start.y + preferredEnd.y) / 2
    ) / 40)}`;
    const laneIndex = channelUsage.get(channelKey) ?? 0;
    channelUsage.set(channelKey, laneIndex + 1);
    const laneOffset = laneIndex === 0
      ? 0
      : Math.ceil(laneIndex / 2) * 22 * (laneIndex % 2 === 1 ? 1 : -1);
    const obstacles = [...nodes.entries()]
      .filter(([id]) => id !== meta.from && id !== meta.to)
      .map(([, node]) => rectOf(node, 18));

    const preferredBlocked = approachBlocked(
      preferredEnd,
      sides.targetSide,
      from,
      obstacles,
      bounds
    );
    const targetSides = preferredBlocked
      ? [sides.targetSide, ...perpendicularSides(sides.targetSide)]
      : [sides.targetSide];
    const options = [];
    for (const targetSide of targetSides) {
      const end = anchor(
        to,
        targetSide,
        targetSide === sides.targetSide ? port.end : 0
      );
      const approachPenalty = approachBlocked(
        end,
        targetSide,
        from,
        obstacles,
        bounds
      ) ? 1 : 0;
      const sidePenalty = sides.preferTargetSide && targetSide !== sides.targetSide ? 1 : 0;
      for (const points of candidates(
        start,
        end,
        sides.sourceSide,
        targetSide,
        bounds,
        laneOffset
      )) {
        options.push({
          points,
          targetSide,
          score: scoreRoute(points, obstacles, existingSegments, sidePenalty, approachPenalty)
        });
      }
    }
    options.sort((first, second) => compareScore(first.score, second.score));
    const chosen = options[0] ?? {
      points: [start, preferredEnd],
      targetSide: sides.targetSide
    };

    edge.x = chosen.points[0].x;
    edge.y = chosen.points[0].y;
    edge.points = chosen.points.map((point) => [
      point.x - edge.x,
      point.y - edge.y
    ]);
    const last = edge.points.at(-1);
    edge.width = last[0];
    edge.height = last[1];
    meta.route = {
      engine: 'graph-aware-v0.3.4',
      sourceSide: sides.sourceSide,
      targetSide: chosen.targetSide,
      axisLock: sides.axisLock,
      bends: Math.max(0, chosen.points.length - 2)
    };
    existingSegments.push(...segmentsFromPoints(chosen.points));
  }
  return scene;
}

function main() {
  const [scenePathArg, specPathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/route-edges.mjs <scene.excalidraw> [spec.json] [-o output.excalidraw]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const specPath = specPathArg && specPathArg !== '-o'
    ? path.resolve(process.cwd(), specPathArg)
    : null;
  const actualFlag = specPath ? flag : specPathArg;
  const actualOutput = specPath ? outputPathArg : flag;
  const outputPath = actualFlag === '-o' && actualOutput
    ? path.resolve(process.cwd(), actualOutput)
    : scenePath;
  writeJson(outputPath, routeEdges(
    readJson(scenePath),
    specPath ? readJson(specPath) : null
  ));
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`route-edges failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
