export const LAYOUT_STRATEGIES = Object.freeze([
  Object.freeze({
    id: 'narrative',
    label: 'Narrative',
    intent: 'Preserve the clearest primary story and make secondary concerns subordinate.'
  }),
  Object.freeze({
    id: 'compact',
    label: 'Compact',
    intent: 'Reduce eye travel and overall horizontal spread without violating hard constraints.'
  }),
  Object.freeze({
    id: 'structured',
    label: 'Structured',
    intent: 'Emphasize semantic grouping and hierarchy over compactness.'
  })
]);

export function strategyById(id) {
  const strategy = LAYOUT_STRATEGIES.find((entry) => entry.id === id);
  if (!strategy) throw new Error(`Unknown layout strategy: ${id}`);
  return strategy;
}

export function applyLayoutStrategy(spec, strategyId) {
  const strategy = strategyById(strategyId);
  const next = structuredClone(spec);
  next.layout = { ...(next.layout ?? {}) };
  next.layoutStrategy = {
    id: strategy.id,
    intent: strategy.intent,
    source: 'cognitive-agent'
  };

  if (strategyId === 'compact') {
    next.layout.aspectRatio = 'tall';
  }

  if (strategyId === 'structured' && isFlowSpec(next)) {
    next.layout.profile = 'layered-flow';
    next.layout.aspectRatio = 'balanced';
  }

  return next;
}

export function isFlowSpec(spec) {
  return ['flow', 'service-flow', 'event-flow', 'data-flow'].includes(spec?.diagramType);
}
