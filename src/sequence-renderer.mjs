import { orderedParticipants, orderedMessages, participantLayouts, messageYById, lifelineEndY } from './sequence-layout.mjs';
import { makeParticipantElements } from './sequence-participants.mjs';
import { activationIntervals, makeActivation } from './sequence-activations.mjs';
import { makeMessageElements } from './sequence-messages.mjs';
import { makeFragmentElements } from './sequence-fragments.mjs';

export function renderSequenceSpec(spec) {
  if (spec?.diagramType !== 'sequence') throw new Error('diagramType must be sequence');
  const participants = orderedParticipants(spec);
  const messages = orderedMessages(spec);
  const layouts = participantLayouts(participants);
  const yById = messageYById(messages);
  const endY = lifelineEndY(messages, yById);
  const fragments = (spec.fragments ?? []).flatMap((item) => makeFragmentElements(item, layouts, yById));
  const lifelines = [];
  const headers = [];
  for (const layout of layouts.values()) {
    const parts = makeParticipantElements(layout, endY);
    lifelines.push(parts.lifeline);
    headers.push(parts.header, parts.label);
  }
  const activations = activationIntervals(messages, yById, participants.map((item) => item.semanticId))
    .map((item, index) => makeActivation(item, layouts, index))
    .filter(Boolean);
  const renderedMessages = [];
  for (const message of messages) {
    const parts = makeMessageElements(message, yById.get(message.semanticId), layouts);
    if (parts) renderedMessages.push(parts.arrow, parts.label);
  }
  return {
    type: 'excalidraw',
    version: 2,
    source: 'excalidraw-skill',
    elements: [...fragments, ...lifelines, ...activations, ...headers, ...renderedMessages],
    appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
    files: {},
    customData: { excalidrawSkill: {
      family: 'sequence',
      renderer: 'sequence-v0.1',
      participantCount: participants.length,
      messageCount: messages.length,
      fragmentCount: (spec.fragments ?? []).length
    } }
  };
}
