import { fitNodeLabel } from './text-fit.mjs';
import { SEQUENCE_LAYOUT, orderedByOrder } from './sequence-base.mjs';

export function orderedParticipants(spec) {
  return orderedByOrder(spec.participants ?? []);
}

export function orderedMessages(spec) {
  return orderedByOrder(spec.messages ?? []);
}

export function participantLayouts(participants) {
  const layouts = new Map();
  let x = SEQUENCE_LAYOUT.originX;
  for (const participant of participants) {
    const fit = fitNodeLabel(participant.label ?? participant.semanticId, {
      widthClasses: [
        { name: 'sequence-compact', width: 180 },
        { name: 'sequence-standard', width: 220 },
        { name: 'sequence-wide', width: 260 }
      ],
      fontSizes: [17, 16]
    });
    const centerX = x + fit.width / 2;
    layouts.set(participant.semanticId, {
      participant,
      fit,
      x,
      centerX,
      width: fit.width,
      height: SEQUENCE_LAYOUT.headerHeight
    });
    x += fit.width + SEQUENCE_LAYOUT.participantGap;
  }
  return layouts;
}

export function messageYById(messages) {
  return new Map(messages.map((message, index) => [
    message.semanticId,
    SEQUENCE_LAYOUT.messageStartY + index * SEQUENCE_LAYOUT.messageGap
  ]));
}

export function lifelineEndY(messages, yById) {
  if (messages.length === 0) return SEQUENCE_LAYOUT.messageStartY + SEQUENCE_LAYOUT.lifelineTail;
  return yById.get(messages.at(-1).semanticId) + SEQUENCE_LAYOUT.lifelineTail;
}
