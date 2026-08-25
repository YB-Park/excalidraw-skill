import { segmentLength, segmentsFromEdge } from './geometry.mjs';
import { estimateTextWidth } from './text-fit.mjs';

const DEFAULT_FONT_SIZE = 13;
const DEFAULT_LINE_HEIGHT = 1.25;
const DEFAULT_MIN_WIDTH = 32;
const DEFAULT_MAX_WIDTH = 180;
const DEFAULT_VERTICAL_MAX_WIDTH = 96;
const DEFAULT_HORIZONTAL_PADDING = 10;
const DEFAULT_ROUTE_MARGIN = 8;

function isCjk(char) {
  return /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/u.test(char);
}

function splitCandidates(text) {
  const value = String(text ?? '').trim();
  const words = value.split(/\s+/u).filter(Boolean);
  if (words.length > 1) {
    return Array.from({ length: words.length - 1 }, (_, index) => [
      words.slice(0, index + 1).join(' '),
      words.slice(index + 1).join(' ')
    ]);
  }
  const chars = [...value];
  if (chars.length > 6 && chars.some(isCjk)) {
    const midpoint = Math.floor(chars.length / 2);
    return [midpoint - 1, midpoint, midpoint + 1]
      .filter((index) => index > 1 && index < chars.length - 1)
      .map((index) => [chars.slice(0, index).join(''), chars.slice(index).join('')]);
  }
  return [];
}

function routeConstrainedMaxWidth(edge, options = {}) {
  const maxWidth = Number(options.maxWidth ?? DEFAULT_MAX_WIDTH);
  if (!edge) return maxWidth;
  const segments = segmentsFromEdge(edge).sort((a, b) => segmentLength(b) - segmentLength(a));
  const longest = segments[0];
  if (!longest) return maxWidth;
  const horizontal = Math.abs(longest.b.x - longest.a.x) >= Math.abs(longest.b.y - longest.a.y);
  if (!horizontal) return Math.min(maxWidth, Number(options.verticalMaxWidth ?? DEFAULT_VERTICAL_MAX_WIDTH));
  const routeMargin = Number(options.routeMargin ?? DEFAULT_ROUTE_MARGIN);
  const minWidth = Number(options.minWidth ?? DEFAULT_MIN_WIDTH);
  return Math.max(minWidth, Math.min(maxWidth, segmentLength(longest) - routeMargin));
}

export function fitEdgeLabel(text, edge = null, options = {}) {
  const originalText = String(text ?? '').trim();
  const fontSize = Number(options.fontSize ?? DEFAULT_FONT_SIZE);
  const lineHeight = Number(options.lineHeight ?? DEFAULT_LINE_HEIGHT);
  const minWidth = Number(options.minWidth ?? DEFAULT_MIN_WIDTH);
  const horizontalPadding = Number(options.horizontalPadding ?? DEFAULT_HORIZONTAL_PADDING);
  const preferredMaxWidth = routeConstrainedMaxWidth(edge, { ...options, minWidth });
  const usableWidth = Math.max(1, preferredMaxWidth - horizontalPadding);
  const oneLineWidth = estimateTextWidth(originalText, fontSize);

  let lines = [originalText];
  let estimatedLineWidths = [oneLineWidth];
  if (oneLineWidth > usableWidth) {
    const candidates = splitCandidates(originalText)
      .map((candidateLines) => ({
        lines: candidateLines,
        widths: candidateLines.map((line) => estimateTextWidth(line, fontSize))
      }))
      .filter(({ widths }) => Math.max(...widths) <= usableWidth)
      .sort((a, b) => Math.max(...a.widths) - Math.max(...b.widths)
        || Math.abs(a.widths[0] - a.widths[1]) - Math.abs(b.widths[0] - b.widths[1]));
    if (candidates[0]) {
      lines = candidates[0].lines;
      estimatedLineWidths = candidates[0].widths;
    }
  }

  const contentWidth = Math.max(0, ...estimatedLineWidths);
  const width = Math.ceil(Math.max(minWidth, contentWidth + horizontalPadding));
  const height = Math.max(22, Math.ceil(lines.length * fontSize * lineHeight + 4));
  return {
    originalText,
    text: lines.join('\n'),
    lines,
    lineCount: lines.length,
    width,
    height,
    fontSize,
    lineHeight,
    preferredMaxWidth: Math.round(preferredMaxWidth),
    estimatedLineWidths: estimatedLineWidths.map((value) => Number(value.toFixed(1)))
  };
}
