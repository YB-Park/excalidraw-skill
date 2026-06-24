const FLOW_TYPES = new Set(['flow', 'service-flow', 'event-flow', 'data-flow']);
const FLOW_PROFILES = new Set(['layered-flow', 'swimlane-flow', 'hub-and-spoke']);

function metaOf(element) {
  return element?.customData?.excalidrawSkill ?? {};
}

function sceneNodes(scene) {
  return new Map((scene.elements ?? [])
    .filter((element) => metaOf(element).role === 'node' && typeof metaOf(element).semanticId === 'string')
    .map((element) => [metaOf(element).semanticId, element]));
}

function sceneFrames(scene) {
  return (scene.elements ?? []).filter((element) => metaOf(element).role === 'frame');
}

function normalizeFamily(diagramType) {
  if (FLOW_TYPES.has(diagramType)) return 'flow';
  return diagramType ?? null;
}

function centerX(node) {
  return Number(node?.x ?? 0) + Number(node?.width ?? 0) / 2;
}

function centerY(node) {
  return Number(node?.y ?? 0) + Number(node?.height ?? 0) / 2;
}

function isExternalSpecNode(node) {
  const shape = String(node?.shapeRef ?? node?.kind ?? '').toLowerCase();
  const group = String(node?.group ?? '').toLowerCase();
  const role = String(node?.hostRole ?? '').toLowerCase();
  return shape.includes('external') || shape.includes('provider') || shape.includes('client') || group.includes('external') || role === 'external';
}

function frameId(frame) {
  return metaOf(frame).semanticId ?? frame.id;
}

function frameChecks(scene, spec, nodeCount) {
  const frames = sceneFrames(scene);
  const allowSingletons = spec?.framePolicy?.allowSingletons === true || spec?.layout?.framePolicy?.allowSingletons === true;
  const singletonFramesAll = frames.filter((frame) => Number(metaOf(frame).memberCount ?? 0) <= 1);
  const allowedSingletonFrames = singletonFramesAll
    .filter((frame) => metaOf(frame).singletonBoundary === true && typeof metaOf(frame).boundaryIntent === 'string')
    .map(frameId);
  const policySingletonFrames = singletonFramesAll
    .filter((frame) => !allowedSingletonFrames.includes(frameId(frame)) && allowSingletons)
    .map(frameId);
  const suspiciousSingletonFrames = singletonFramesAll
    .filter((frame) => !allowedSingletonFrames.includes(frameId(frame)) && !allowSingletons)
    .map(frameId);
  const excessiveSingletonFrames = singletonFramesAll.length > 2 ? singletonFramesAll.map(frameId) : [];
  const fullSceneFrames = frames
    .filter((frame) => Number(metaOf(frame).memberCount ?? 0) >= nodeCount && nodeCount > 0)
    .map(frameId);
  const budget = Number.isInteger(scene.customData?.excalidrawSkill?.framePolicy?.budget)
    ? scene.customData.excalidrawSkill.framePolicy.budget
    : Number.isInteger(spec?.framePolicy?.maxFrames)
      ? spec.framePolicy.maxFrames
      : null;
  const frameBudgetExceeded = budget === null ? 0 : Math.max(0, frames.length - budget);
  const allowFullScene = spec?.framePolicy?.allowFullScene === true;
  const unresolvedFrameCollisions = Number(scene.customData?.excalidrawSkill?.framePolicy?.unresolvedFrameCollisions ?? 0);

  return {
    metrics: {
      visibleFrames: frames.length,
      singletonFrames: singletonFramesAll.length,
      allowedSingletonFrames: allowedSingletonFrames.length,
      policySingletonFrames: policySingletonFrames.length,
      suspiciousSingletonFrames: suspiciousSingletonFrames.length,
      excessiveSingletonFrames: excessiveSingletonFrames.length,
      fullSceneFrames: allowFullScene ? 0 : fullSceneFrames.length,
      frameBudgetExceeded,
      unresolvedFrameCollisions
    },
    details: {
      allowedSingletonFrames,
      policySingletonFrames,
      suspiciousSingletonFrames,
      excessiveSingletonFrames,
      fullSceneFrames: allowFullScene ? [] : fullSceneFrames,
      frameBudget: budget,
      allowSingletons,
      unresolvedFrameCollisions
    },
    suggestions: [
      ...suspiciousSingletonFrames.map((frame) => ({ operation: 'justify-singleton-frame', frame })),
      ...excessiveSingletonFrames.map((frame) => ({ operation: 'reduce-singleton-frames', frame })),
      ...(allowFullScene ? [] : fullSceneFrames.map((frame) => ({ operation: 'remove-full-scene-frame', frame }))),
      ...(frameBudgetExceeded > 0 ? [{ operation: 'reduce-visible-frames', maxFrames: budget }] : []),
      ...(unresolvedFrameCollisions > 0 ? [{ operation: 'increase-frame-spacing', unresolvedFrameCollisions }] : [])
    ],
    pass: suspiciousSingletonFrames.length === 0
      && excessiveSingletonFrames.length === 0
      && (allowFullScene || fullSceneFrames.length === 0)
      && frameBudgetExceeded === 0
      && unresolvedFrameCollisions === 0
  };
}

function checkLayeredSystem(scene, spec, nodes) {
  const layers = Array.isArray(spec.architecture?.layers)
    ? spec.architecture.layers
        .filter((layer) => layer && typeof layer.id === 'string')
        .map((layer, index) => ({ id: layer.id, order: Number.isFinite(layer.order) ? layer.order : index }))
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    : [];
  const layerIds = new Set(layers.map((layer) => layer.id));
  const missingLayerAssignments = [];
  const byLayer = new Map(layers.map((layer) => [layer.id, []]));
  const externalIds = [];

  for (const node of spec.nodes ?? []) {
    if (isExternalSpecNode(node) && !node.layer) {
      externalIds.push(node.semanticId);
      continue;
    }
    if (!node.layer || (layerIds.size > 0 && !layerIds.has(node.layer))) {
      missingLayerAssignments.push(node.semanticId);
      continue;
    }
    if (!byLayer.has(node.layer)) byLayer.set(node.layer, []);
    const sceneNode = nodes.get(node.semanticId);
    if (sceneNode) byLayer.get(node.layer).push(sceneNode);
  }

  const populated = layers
    .map((layer) => ({ layer, members: byLayer.get(layer.id) ?? [] }))
    .filter(({ members }) => members.length > 0);
  const layerOrderViolations = [];
  for (let index = 0; index < populated.length - 1; index += 1) {
    const upper = populated[index];
    const lower = populated[index + 1];
    const upperBottom = Math.max(...upper.members.map((node) => Number(node.y ?? 0) + Number(node.height ?? 0)));
    const lowerTop = Math.min(...lower.members.map((node) => Number(node.y ?? 0)));
    if (upperBottom >= lowerTop) {
      layerOrderViolations.push({ upperLayer: upper.layer.id, lowerLayer: lower.layer.id, upperBottom, lowerTop });
    }
  }

  const focus = Array.isArray(spec.architecture?.focus) ? spec.architecture.focus : [];
  const focusMissing = focus.filter((id) => !nodes.has(id));
  const focusNotMarked = focus.filter((id) => nodes.has(id) && metaOf(nodes.get(id)).architectureFocus !== true);

  const internalNodes = [...nodes.entries()].filter(([id]) => !externalIds.includes(id)).map(([, node]) => node);
  const externalPlacementViolations = [];
  if (internalNodes.length > 0) {
    const internalRight = Math.max(...internalNodes.map((node) => Number(node.x ?? 0) + Number(node.width ?? 0)));
    for (const id of externalIds) {
      const node = nodes.get(id);
      if (node && Number(node.x ?? 0) <= internalRight) externalPlacementViolations.push({ node: id, x: Number(node.x ?? 0), internalRight });
    }
  }

  const metrics = { missingLayerAssignments: missingLayerAssignments.length, layerOrderViolations: layerOrderViolations.length, focusMissing: focusMissing.length, focusNotMarked: focusNotMarked.length, externalPlacementViolations: externalPlacementViolations.length };
  const suggestions = [
    ...missingLayerAssignments.map((node) => ({ operation: 'assign-architecture-layer', node })),
    ...layerOrderViolations.map((violation) => ({ operation: 'restore-layer-order', ...violation })),
    ...focusMissing.map((node) => ({ operation: 'add-focus-node', node })),
    ...focusNotMarked.map((node) => ({ operation: 'mark-architecture-focus', node })),
    ...externalPlacementViolations.map((violation) => ({ operation: 'move-external-outside-stack', ...violation }))
  ];
  return { metrics, details: { missingLayerAssignments, layerOrderViolations, focusMissing, focusNotMarked, externalPlacementViolations }, suggestions, pass: Object.values(metrics).every((value) => value === 0) };
}

function primaryFlowIds(spec) {
  const explicit = Array.isArray(spec.layout?.primaryFlow) ? spec.layout.primaryFlow : [];
  if (explicit.length > 0) return explicit;
  return (spec.nodes ?? [])
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.layoutHints?.importance === 'primary')
    .sort((a, b) => {
      const aRank = Number.isFinite(a.node.layoutHints?.rank) ? a.node.layoutHints.rank : a.index;
      const bRank = Number.isFinite(b.node.layoutHints?.rank) ? b.node.layoutHints.rank : b.index;
      return aRank - bRank || a.index - b.index;
    })
    .map(({ node }) => node.semanticId);
}

function centerLaneAxisViolations(spec, nodes) {
  if (spec.layout?.profile !== 'swimlane-flow') return [];
  const direction = spec.layout?.direction ?? 'left-to-right';
  const centerLane = (spec.layout?.lanes ?? []).find((lane) => lane.position === 'center')?.id;
  if (!centerLane) return [];
  const axis = direction === 'top-to-bottom' ? Number(spec.layout?.centerAxisX ?? 460) : Number(spec.layout?.centerAxisY ?? 280);
  const grouped = new Map();
  for (const node of spec.nodes ?? []) {
    if (node.layoutHints?.lane !== centerLane) continue;
    const rank = Number.isFinite(node.layoutHints?.rank) ? node.layoutHints.rank : 0;
    const list = grouped.get(rank) ?? [];
    list.push(node);
    grouped.set(rank, list);
  }
  const violations = [];
  for (const group of grouped.values()) {
    if (group.length !== 1) continue;
    const specNode = group[0];
    const sceneNode = nodes.get(specNode.semanticId);
    if (!sceneNode) continue;
    const value = direction === 'top-to-bottom' ? centerX(sceneNode) : centerY(sceneNode);
    if (Math.abs(value - axis) > 1) violations.push({ node: specNode.semanticId, direction, axis, value: Number(value.toFixed(1)) });
  }
  return violations;
}

function checkFlow(spec, nodes) {
  const primary = primaryFlowIds(spec);
  const primaryFlowMissing = primary.filter((id) => !nodes.has(id));
  const present = primary.filter((id) => nodes.has(id));
  const direction = spec.layout?.direction ?? 'left-to-right';
  const primaryFlowOrderViolations = [];
  for (let index = 0; index < present.length - 1; index += 1) {
    const from = nodes.get(present[index]);
    const to = nodes.get(present[index + 1]);
    const fromValue = direction === 'top-to-bottom' ? centerY(from) : centerX(from);
    const toValue = direction === 'top-to-bottom' ? centerY(to) : centerX(to);
    if (fromValue >= toValue) primaryFlowOrderViolations.push({ from: present[index], to: present[index + 1], direction, fromValue, toValue });
  }
  const centerAxisViolations = centerLaneAxisViolations(spec, nodes);
  const metrics = { primaryFlowMissing: primaryFlowMissing.length, primaryFlowOrderViolations: primaryFlowOrderViolations.length, centerAxisViolations: centerAxisViolations.length };
  return { metrics, details: { primaryFlowMissing, primaryFlowOrderViolations, centerAxisViolations, primaryFlow: primary }, suggestions: [...primaryFlowMissing.map((node) => ({ operation: 'add-primary-flow-node', node })), ...primaryFlowOrderViolations.map((violation) => ({ operation: 'restore-primary-flow-order', ...violation })), ...centerAxisViolations.map((violation) => ({ operation: 'restore-center-axis', ...violation }))], pass: Object.values(metrics).every((value) => value === 0) };
}

function checkComponentView(scene, spec, nodes) {
  const focusModule = spec.module?.focusModule ?? null;
  const expectedInternal = (spec.nodes ?? []).filter((node) => !isExternalSpecNode(node)).map((node) => node.semanticId);
  const expectedExternal = (spec.nodes ?? []).filter((node) => isExternalSpecNode(node)).map((node) => node.semanticId);
  const missingInternal = expectedInternal.filter((id) => !nodes.has(id));
  const scopeViolations = expectedInternal.filter((id) => nodes.has(id) && metaOf(nodes.get(id)).moduleScope !== 'internal');
  const externalScopeViolations = expectedExternal.filter((id) => nodes.has(id) && metaOf(nodes.get(id)).moduleScope !== 'external');
  const frames = sceneFrames(scene);
  const moduleFrames = frames.filter((frame) => metaOf(frame).semanticId === focusModule);
  const moduleBoundaryViolations = moduleFrames.length === 1 ? 0 : 1;
  const externalPlacementViolations = [];
  if (moduleFrames.length === 1) {
    const frame = moduleFrames[0];
    const left = Number(frame.x ?? 0);
    const right = left + Number(frame.width ?? 0);
    const top = Number(frame.y ?? 0);
    const bottom = top + Number(frame.height ?? 0);
    for (const id of expectedExternal) {
      const node = nodes.get(id);
      if (!node) continue;
      const nodeLeft = Number(node.x ?? 0);
      const nodeRight = nodeLeft + Number(node.width ?? 0);
      const nodeTop = Number(node.y ?? 0);
      const nodeBottom = nodeTop + Number(node.height ?? 0);
      if (nodeRight > left && nodeLeft < right && nodeBottom > top && nodeTop < bottom) externalPlacementViolations.push(id);
    }
  }
  const metrics = { missingInternal: missingInternal.length, scopeViolations: scopeViolations.length, externalScopeViolations: externalScopeViolations.length, moduleBoundaryViolations, externalPlacementViolations: externalPlacementViolations.length };
  return { metrics, details: { focusModule, expectedInternal, expectedExternal, missingInternal, scopeViolations, externalScopeViolations, moduleFrameCount: moduleFrames.length, externalPlacementViolations }, suggestions: [...missingInternal.map((node) => ({ operation: 'add-module-component', node })), ...scopeViolations.map((node) => ({ operation: 'mark-module-internal', node, module: focusModule })), ...externalScopeViolations.map((node) => ({ operation: 'mark-module-external', node })), ...(moduleBoundaryViolations ? [{ operation: 'restore-single-module-boundary', module: focusModule }] : []), ...externalPlacementViolations.map((node) => ({ operation: 'move-external-outside-module', node, module: focusModule }))], pass: Object.values(metrics).every((value) => value === 0) };
}

export function createFamilyQualityReport(scene, spec = null) {
  const diagramType = spec?.diagramType ?? null;
  const family = normalizeFamily(diagramType);
  const profile = spec?.layout?.profile ?? scene.customData?.excalidrawSkill?.layout?.profile ?? null;
  const nodes = sceneNodes(scene);
  const frames = frameChecks(scene, spec, nodes.size);
  let supported = true;
  let reason = null;
  let familyResult = { metrics: {}, details: {}, suggestions: [], pass: true };
  if (family === 'flow') {
    if (!FLOW_PROFILES.has(profile)) { supported = false; reason = `Unsupported flow profile: ${profile ?? 'none'}`; } else { familyResult = checkFlow(spec, nodes); }
  } else if (family === 'system-architecture') {
    if (profile !== 'layered-system') { supported = false; reason = `Unsupported system-architecture profile: ${profile ?? 'none'}`; } else { familyResult = checkLayeredSystem(scene, spec, nodes); }
  } else if (family === 'module-architecture') {
    if (profile !== 'component-view') { supported = false; reason = `Unsupported module-architecture profile: ${profile ?? 'none'}`; } else { familyResult = checkComponentView(scene, spec, nodes); }
  } else if (family === 'sequence') {
    supported = false;
    reason = 'Renderer quality checks are not implemented for sequence';
  }
  const metrics = { ...frames.metrics, ...familyResult.metrics };
  const details = { frames: frames.details, ...familyResult.details };
  const suggestedPatches = [...frames.suggestions, ...familyResult.suggestions, ...(supported ? [] : [{ operation: 'implement-family-renderer', family, profile }])];
  return { version: '0.2.2', family, diagramType, profile, supported, reason, pass: supported && frames.pass && familyResult.pass, metrics, details, suggestedPatches };
}
