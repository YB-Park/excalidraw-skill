import { baseElement, makeText, SEQUENCE_LAYOUT } from './sequence-base.mjs';

function fill(kind) {
  if (kind === 'external' || kind === 'actor') return '#f8fafc';
  if (kind === 'database') return '#ecfeff';
  if (kind === 'thread') return '#f5f3ff';
  return '#eff6ff';
}

export function makeParticipantElements(layout, lifelineEndY) {
  const { participant, fit, x, centerX, width, height } = layout;
  const header = baseElement('rectangle', participant.semanticId, 'sequence-participant');
  Object.assign(header, {
    x,
    y: SEQUENCE_LAYOUT.headerY,
    width,
    height,
    backgroundColor: fill(participant.kind)
  });
  header.customData.excalidrawSkill.kind = participant.kind ?? 'module';
  header.customData.excalidrawSkill.order = participant.order ?? 0;

  const labelHeight = Math.ceil(fit.lineCount * fit.fontSize * fit.lineHeight);
  const label = makeText(
    `${participant.semanticId}_label`,
    'sequence-participant-label',
    fit.text,
    x + 14,
    SEQUENCE_LAYOUT.headerY + (height - labelHeight) / 2,
    width - 28,
    labelHeight,
    { fontSize: fit.fontSize, lineHeight: fit.lineHeight }
  );
  label.customData.excalidrawSkill.participant = participant.semanticId;
  label.customData.excalidrawSkill.sourceLabel = fit.originalLabel;

  const lifeline = baseElement('line', `${participant.semanticId}_lifeline`, 'sequence-lifeline');
  lifeline.x = centerX;
  lifeline.y = SEQUENCE_LAYOUT.headerY + height;
  lifeline.width = 0;
  lifeline.height = lifelineEndY - lifeline.y;
  lifeline.points = [[0, 0], [0, lifeline.height]];
  lifeline.strokeColor = '#94a3b8';
  lifeline.strokeStyle = 'dashed';
  lifeline.strokeWidth = 1;
  lifeline.customData.excalidrawSkill.participant = participant.semanticId;
  return { header, label, lifeline };
}
