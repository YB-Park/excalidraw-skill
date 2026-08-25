import { absolutePoints, polylineLength } from './geometry.mjs';

function metaOf(element) {
  return element.customData?.excalidrawSkill ?? {};
}

function primaryPairSet(spec) {
  const ids = spec?.layout?.primaryFlow ?? [];
  const pairs = new Set();
  for (let index = 0; index < ids.length - 1; index += 1) {
    pairs.add(`${ids[index]}->${ids[index + 1]}`);
  }
  return pairs;
}

function routeMetrics(edge) {
  const points = absolutePoints(edge);
  if (points.length < 2) {
    return {
      bends: 0,
      routeLength: 0,
      idealOrthogonalLength: 0,
      extraLength: 0,
      detourRatio: 1
    };
  }
  const first = points[0];
  const last = points.at(-1);
  const idealOrthogonalLength = Math.abs(last.x - first.x) + Math.abs(last.y - first.y);
  const routeLength = polylineLength(points);
  const extraLength = Math.max(0, routeLength - idealOrthogonalLength);
  const detourRatio = idealOrthogonalLength > 1
    ? routeLength / idealOrthogonalLength
    : routeLength > 1
      ? 2
      : 1;
  return {
    bends: Math.max(0, points.length - 2),
    routeLength,
    idealOrthogonalLength,
    extraLength,
    detourRatio
  };
}

function sceneComposition(nodes) {
  if (nodes.length === 0) {
    return {
      density: 0,
      balanceOffset: 0,
      width: 0,
      height: 0
    };
  }
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const totalNodeArea = nodes.reduce((sum, node) => sum + Math.max(0, node.width * node.height), 0);
  const weightedCenter = nodes.reduce((acc, node) => {
    const area = Math.max(1, node.width * node.height);
    acc.x += (node.x + node.width / 2) * area;
    acc.y += (node.y + node.height / 2) * area;
    acc.area += area;
    return acc;
  }, { x: 0, y: 0, area: 0 });
  const centerX = weightedCenter.x / weightedCenter.area;
  const centerY = weightedCenter.y / weightedCenter.area;
  const canvasCenterX = minX + width / 2;
  const canvasCenterY = minY + height / 2;
  const diagonal = Math.hypot(width, height);
  return {
    density: totalNodeArea / (width * height),
    balanceOffset: diagonal > 0
      ? Math.hypot(centerX - canvasCenterX, centerY - canvasCenterY) / diagonal
      : 0,
    width,
    height
  };
}

function rounded(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export function createPerceptualQuality(scene, spec = null) {
  const nodes = [];
  const edges = [];
  for (const element of scene?.elements ?? []) {
    const role = metaOf(element).role;
    if (role === 'node') nodes.push(element);
    if (role === 'edge') edges.push(element);
  }

  const primaryPairs = primaryPairSet(spec);
  const edgeDetails = edges.map((edge) => {
    const meta = metaOf(edge);
    const metrics = routeMetrics(edge);
    const primary = primaryPairs.has(`${meta.from}->${meta.to}`)
      || spec?.edges?.some((candidate) => {
        const candidateId = candidate.semanticId ?? `${candidate.from}_to_${candidate.to}`;
        return candidateId === meta.semanticId && candidate.routeHints?.priority === 'primary';
      });
    const severeDetour = metrics.detourRatio >= 1.65 && metrics.extraLength >= 100;
    const moderateDetour = !severeDetour && metrics.detourRatio >= 1.3 && metrics.extraLength >= 60;
    const highBendComplexity = metrics.bends >= 3;
    return {
      edge: meta.semanticId,
      from: meta.from,
      to: meta.to,
      primary: Boolean(primary),
      bends: metrics.bends,
      routeLength: rounded(metrics.routeLength, 1),
      idealOrthogonalLength: rounded(metrics.idealOrthogonalLength, 1),
      extraLength: rounded(metrics.extraLength, 1),
      detourRatio: rounded(metrics.detourRatio, 2),
      severeDetour,
      moderateDetour,
      highBendComplexity
    };
  });

  const totalBends = edgeDetails.reduce((sum, edge) => sum + edge.bends, 0);
  const primaryEdges = edgeDetails.filter((edge) => edge.primary);
  const primaryBends = primaryEdges.reduce((sum, edge) => sum + edge.bends, 0);
  const severeDetours = edgeDetails.filter((edge) => edge.severeDetour);
  const moderateDetours = edgeDetails.filter((edge) => edge.moderateDetour);
  const highBendEdges = edgeDetails.filter((edge) => edge.highBendComplexity);
  const averageDetourRatio = edgeDetails.length
    ? edgeDetails.reduce((sum, edge) => sum + edge.detourRatio, 0) / edgeDetails.length
    : 1;
  const maxDetourRatio = edgeDetails.length
    ? Math.max(...edgeDetails.map((edge) => edge.detourRatio))
    : 1;
  const primaryAverageDetourRatio = primaryEdges.length
    ? primaryEdges.reduce((sum, edge) => sum + edge.detourRatio, 0) / primaryEdges.length
    : 1;
  const averageBendsPerEdge = edgeDetails.length ? totalBends / edgeDetails.length : 0;
  const composition = sceneComposition(nodes);

  // This is a project-specific comparison score, not a scientific time estimate.
  // It intentionally weights path continuity and primary-flow readability heavily.
  const readabilityCost = edgeDetails.reduce((cost, edge) => {
    const primaryMultiplier = edge.primary ? 1.8 : 1;
    return cost
      + edge.bends * 8 * primaryMultiplier
      + (edge.extraLength / 80) * primaryMultiplier
      + (edge.severeDetour ? 18 * primaryMultiplier : 0)
      + (edge.moderateDetour ? 6 * primaryMultiplier : 0)
      + (edge.highBendComplexity ? 6 * primaryMultiplier : 0);
  }, 0);

  const warnings = [];
  for (const edge of severeDetours) {
    warnings.push({
      kind: 'severe-edge-detour',
      edge: edge.edge,
      detourRatio: edge.detourRatio,
      extraLength: edge.extraLength
    });
  }
  for (const edge of highBendEdges) {
    warnings.push({
      kind: edge.primary ? 'primary-flow-continuity' : 'edge-bend-complexity',
      edge: edge.edge,
      bends: edge.bends,
      routeLength: edge.routeLength
    });
  }
  if (averageBendsPerEdge >= 1.25 && edgeDetails.length >= 5) {
    warnings.push({
      kind: 'scene-bend-complexity',
      averageBendsPerEdge: rounded(averageBendsPerEdge, 2),
      totalBends
    });
  }
  if (composition.balanceOffset > 0.18 && nodes.length >= 5) {
    warnings.push({
      kind: 'composition-imbalance',
      balanceOffset: rounded(composition.balanceOffset, 3)
    });
  }
  if (composition.density < 0.035 && nodes.length >= 5) {
    warnings.push({
      kind: 'composition-too-sparse',
      density: rounded(composition.density, 3)
    });
  }

  const suggestedPatches = [];
  for (const edge of severeDetours) {
    suggestedPatches.push({
      operation: 'shorten-edge-route',
      edge: edge.edge,
      targetDetourRatio: 1.3
    });
  }
  for (const edge of highBendEdges) {
    suggestedPatches.push({
      operation: edge.primary ? 'straighten-primary-flow' : 'reduce-edge-bends',
      edge: edge.edge,
      maxBends: edge.primary ? 2 : 2
    });
  }

  return {
    version: '0.2.0',
    mode: 'advisory',
    metrics: {
      readabilityCost: rounded(readabilityCost, 2),
      totalBends,
      averageBendsPerEdge: rounded(averageBendsPerEdge, 2),
      highBendEdges: highBendEdges.length,
      primaryFlowBends: primaryBends,
      primaryFlowAverageBends: primaryEdges.length ? rounded(primaryBends / primaryEdges.length, 2) : 0,
      averageDetourRatio: rounded(averageDetourRatio, 2),
      maxDetourRatio: rounded(maxDetourRatio, 2),
      primaryFlowAverageDetourRatio: rounded(primaryAverageDetourRatio, 2),
      severeDetours: severeDetours.length,
      moderateDetours: moderateDetours.length,
      compositionDensity: rounded(composition.density, 3),
      compositionBalanceOffset: rounded(composition.balanceOffset, 3)
    },
    details: {
      edges: edgeDetails,
      composition: {
        width: rounded(composition.width, 1),
        height: rounded(composition.height, 1)
      },
      warnings
    },
    suggestedPatches
  };
}
