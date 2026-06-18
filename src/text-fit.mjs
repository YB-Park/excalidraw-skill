const WIDTH_CLASSES = Object.freeze([
  { name: 'compact', width: 180 },
  { name: 'standard', width: 220 },
  { name: 'wide', width: 260 }
]);
const FONT_SIZES = Object.freeze([18, 17, 16]);
const HORIZONTAL_PADDING = 32;
const LINE_HEIGHT = 1.25;

function isCjk(char) { return /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/u.test(char); }
function charFactor(char) {
  if (isCjk(char)) return 1;
  if (/\s/u.test(char)) return 0.33;
  if (/[A-Z]/u.test(char)) return 0.65;
  if (/[0-9]/u.test(char)) return 0.58;
  if (/[ilI1.,'`|:;]/u.test(char)) return 0.3;
  if (/[MW@#%&]/u.test(char)) return 0.85;
  return 0.55;
}
export function estimateTextWidth(text, fontSize = 18) { return [...String(text)].reduce((sum, char) => sum + charFactor(char) * fontSize, 0); }
function splitCandidates(label) {
  const words = String(label).trim().split(/\s+/u).filter(Boolean);
  if (words.length > 1) return Array.from({ length: words.length - 1 }, (_, index) => [words.slice(0, index + 1).join(' '), words.slice(index + 1).join(' ')]);
  const chars = [...String(label).trim()];
  if (chars.length > 5 && chars.some(isCjk)) {
    const midpoint = Math.floor(chars.length / 2);
    return [midpoint - 1, midpoint, midpoint + 1].filter((index) => index > 1 && index < chars.length - 1).map((index) => [chars.slice(0, index).join(''), chars.slice(index).join('')]);
  }
  return [];
}
function bestWrap(label, fontSize, usableWidth) {
  const candidates = splitCandidates(label)
    .map((lines) => ({ lines, widths: lines.map((line) => estimateTextWidth(line, fontSize)) }))
    .filter(({ widths }) => Math.max(...widths) <= usableWidth);
  candidates.sort((a, b) => Math.max(...a.widths) - Math.max(...b.widths) || Math.abs(a.widths[0] - a.widths[1]) - Math.abs(b.widths[0] - b.widths[1]));
  return candidates[0] ?? null;
}
export function fitNodeLabel(label, options = {}) {
  const originalLabel = String(label ?? '').trim();
  const widthClasses = options.widthClasses ?? WIDTH_CLASSES;
  const fontSizes = options.fontSizes ?? FONT_SIZES;
  const horizontalPadding = options.horizontalPadding ?? HORIZONTAL_PADDING;
  for (const fontSize of fontSizes) {
    for (const sizeClass of widthClasses) {
      const usableWidth = sizeClass.width - horizontalPadding;
      const oneLineWidth = estimateTextWidth(originalLabel, fontSize);
      if (oneLineWidth <= usableWidth) return { originalLabel, text: originalLabel, lines: [originalLabel], lineCount: 1, fontSize, width: sizeClass.width, height: 80, sizeClass: sizeClass.name, overflow: false, estimatedLineWidths: [oneLineWidth], lineHeight: LINE_HEIGHT };
      const wrapped = bestWrap(originalLabel, fontSize, usableWidth);
      if (wrapped) return { originalLabel, text: wrapped.lines.join('\n'), lines: wrapped.lines, lineCount: 2, fontSize, width: sizeClass.width, height: 96, sizeClass: sizeClass.name, overflow: false, estimatedLineWidths: wrapped.widths, lineHeight: LINE_HEIGHT };
    }
  }
  const fallback = widthClasses.at(-1); const fontSize = fontSizes.at(-1); const usableWidth = fallback.width - horizontalPadding; const wrapped = bestWrap(originalLabel, fontSize, Number.POSITIVE_INFINITY); const lines = wrapped?.lines ?? [originalLabel]; const widths = lines.map((line) => estimateTextWidth(line, fontSize));
  return { originalLabel, text: lines.join('\n'), lines, lineCount: lines.length, fontSize, width: fallback.width, height: lines.length > 1 ? 96 : 80, sizeClass: fallback.name, overflow: Math.max(...widths) > usableWidth || lines.length > 2, estimatedLineWidths: widths, lineHeight: LINE_HEIGHT };
}
export function textElementOverflows(textElement) {
  const lines = String(textElement.text ?? '').split('\n'); const fontSize = Number(textElement.fontSize) || 18; const lineHeight = Number(textElement.lineHeight) || LINE_HEIGHT; const maxWidth = Math.max(0, ...lines.map((line) => estimateTextWidth(line, fontSize))); const requiredHeight = lines.length * fontSize * lineHeight;
  return { overflow: maxWidth > Number(textElement.width || 0) + 2 || requiredHeight > Number(textElement.height || 0) + 2, estimatedWidth: maxWidth, requiredHeight, lineCount: lines.length };
}
export const NODE_WIDTH_CLASSES = WIDTH_CLASSES;
