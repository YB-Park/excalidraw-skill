import { baseElement, makeText, SEQUENCE_LAYOUT as L } from './sequence-base.mjs';

function idsOf(fragment) {
  const ids = new Set(fragment.messageIds ?? []);
  for (const branch of fragment.branches ?? []) {
    for (const id of branch.messageIds ?? []) ids.add(id);
  }
  return [...ids];
}

export function makeFragmentElements(fragment, layouts, yById) {
  const ids = idsOf(fragment).filter((id) => yById.has(id));
  if (!ids.length || !layouts.size) return [];
  const values = [...layouts.values()];
  const first = values[0];
  const last = values.at(-1);
  const left = first.x - L.fragmentPaddingX;
  const right = last.x + last.width + L.fragmentPaddingX;
  const ys = ids.map((id) => yById.get(id));
  const top = Math.min(...ys) - L.fragmentPaddingY;
  const bottom = Math.max(...ys) + L.fragmentPaddingY;

  const box = baseElement('rectangle', fragment.semanticId, 'sequence-fragment');
  Object.assign(box, {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    backgroundColor: 'transparent',
    strokeColor: '#64748b',
    strokeStyle: ['timeout', 'retry'].includes(fragment.kind) ? 'dashed' : 'solid',
    strokeWidth: 1
  });
  Object.assign(box.customData.excalidrawSkill, { kind: fragment.kind, messageIds: ids });

  const title = makeText(
    `${fragment.semanticId}_label`,
    'sequence-fragment-label',
    `${String(fragment.kind ?? '').toUpperCase()}${fragment.label ? `  ${fragment.label}` : ''}`,
    left + 10,
    top + 6,
    Math.min(360, right - left - 20),
    22,
    { fontSize: 14, textAlign: 'left' }
  );
  title.customData.excalidrawSkill.fragment = fragment.semanticId;
  const result = [box, title];

  for (let index = 1; index < (fragment.branches ?? []).length; index += 1) {
    const branch = fragment.branches[index];
    const branchIds = (branch.messageIds ?? []).filter((id) => yById.has(id));
    if (!branchIds.length) continue;
    const y = Math.min(...branchIds.map((id) => yById.get(id))) - L.messageGap / 2;
    const line = baseElement('line', `${fragment.semanticId}_branch_${index}`, 'sequence-fragment-separator');
    Object.assign(line, {
      x: left,
      y,
      width: right - left,
      height: 0,
      points: [[0, 0], [right - left, 0]],
      strokeColor: '#94a3b8',
      strokeStyle: 'dashed',
      strokeWidth: 1
    });
    const label = makeText(
      `${fragment.semanticId}_branch_${index}_label`,
      'sequence-fragment-branch-label',
      branch.label ?? `branch ${index + 1}`,
      left + 10,
      y + 4,
      220,
      20,
      { fontSize: 13, textAlign: 'left' }
    );
    result.push(line, label);
  }
  return result;
}
