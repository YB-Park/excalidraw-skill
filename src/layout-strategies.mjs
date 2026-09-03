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
    intent: 'Emphasize the conceptual center and relationship structure instead of preserving the original lane composition.'
  })
]);

export function strategyById(id) {
  const strategy = LAYOUT_STRATEGIES.find((entry) => entry.id === id);
  if (!strategy) throw new Error(`Unknown layout strategy: ${id}`);
  return strategy;
}

function primaryFlowIds(spec) {
  const explicit = Array.isArray(spec?.layout?.primaryFlow)
    ? spec.layout.primaryFlow.filter((id) => typeof id === 'string')
    : [];
  if (explicit.length > 0) return explicit;

  return (spec?.nodes ?? [])
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node?.layoutHints?.importance === 'primary' && typeof node?.semanticId === 'string')
    .sort((a, b) => {
      const aRank = Number.isFinite(a.node.layoutHints?.rank) ? a.node.layoutHints.rank : a.index;
      const bRank = Number.isFinite(b.node.layoutHints?.rank) ? b.node.layoutHints.rank : b.index;
      return aRank - bRank || a.index - b.index;
    })
    .map(({ node }) => node.semanticId);
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
    const primary = primaryFlowIds(next);
    next.layout.profile = primary.length >= 2 ? 'layered-flow' : 'hub-and-spoke';
    next.layout.aspectRatio = 'balanced';
  }

  return next;
}

export function isFlowSpec(spec) {
  return ['flow', 'service-flow', 'event-flow', 'data-flow'].includes(spec?.diagramType);
}
