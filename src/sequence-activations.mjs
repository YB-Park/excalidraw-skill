import { baseElement, SEQUENCE_LAYOUT } from './sequence-base.mjs';

export function buildActivations(messages, yById, layouts) {
  const open = new Map();
  const result = [];
  for (const message of messages) {
    const y = yById.get(message.semanticId);
    const participant = message.activationParticipant ?? (message.activation === 'end' ? message.from : message.to);
    if (message.activation === 'start' && layouts.has(participant)) open.set(participant, y - 10);
    if (message.activation === 'end' && open.has(participant)) {
      result.push(makeActivation(participant, open.get(participant), y + 10, layouts, result.length));
      open.delete(participant);
    }
  }
  return result;
}

function makeActivation(participant, startY, endY, layouts, index) {
  const layout = layouts.get(participant);
  const element = baseElement('rectangle', `${participant}_activation_${index}`, 'sequence-activation');
  element.x = layout.centerX - SEQUENCE_LAYOUT.activationWidth / 2;
  element.y = startY;
  element.width = SEQUENCE_LAYOUT.activationWidth;
  element.height = Math.max(18, endY - startY);
  element.backgroundColor = '#dbeafe';
  element.strokeColor = '#2563eb';
  element.strokeWidth = 1;
  element.customData.excalidrawSkill.participant = participant;
  return element;
}
