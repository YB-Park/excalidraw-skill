export const SEQUENCE_LAYOUT = Object.freeze({
  originX: 120,
  headerY: 80,
  headerHeight: 76,
  participantGap: 110,
  messageStartY: 240,
  messageGap: 86,
  lifelineTail: 90,
  fragmentPaddingX: 34,
  fragmentPaddingY: 34,
  activationWidth: 14
});

export function safeId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function baseElement(type, semanticId, role) {
  return {
    id: safeId(type, semanticId),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: '#334155',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0.5,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: type === 'rectangle' ? { type: 3 } : null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    customData: { excalidrawSkill: { semanticId, role } }
  };
}

export function makeText(id, role, text, x, y, width, height, options = {}) {
  const element = baseElement('text', id, role);
  Object.assign(element, {
    x, y, width, height,
    backgroundColor: 'transparent',
    text,
    originalText: text,
    fontSize: options.fontSize ?? 17,
    fontFamily: options.fontFamily ?? 2,
    textAlign: options.textAlign ?? 'center',
    verticalAlign: options.verticalAlign ?? 'middle',
    containerId: null,
    lineHeight: options.lineHeight ?? 1.25
  });
  element.customData.excalidrawSkill.fontRole = options.fontRole ?? 'default';
  return element;
}

export function orderedByOrder(items = []) {
  return items.map((value, index) => ({ value, index }))
    .sort((a, b) => {
      const ao = Number.isFinite(a.value.order) ? a.value.order : a.index;
      const bo = Number.isFinite(b.value.order) ? b.value.order : b.index;
      return ao - bo || a.index - b.index;
    })
    .map(({ value }) => value);
}
