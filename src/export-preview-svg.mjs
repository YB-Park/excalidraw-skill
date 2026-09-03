#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function elementBounds(element) {
  const x = finite(element.x);
  const y = finite(element.y);
  return {
    left: Math.min(x, x + finite(element.width)),
    right: Math.max(x, x + finite(element.width)),
    top: Math.min(y, y + finite(element.height)),
    bottom: Math.max(y, y + finite(element.height))
  };
}

export function sceneBounds(elements, padding = 60) {
  const visible = elements.filter((element) => !element?.isDeleted);
  if (visible.length === 0) return { x: 0, y: 0, width: 1000, height: 700 };
  const bounds = visible.flatMap((element) => {
    const content = [elementBounds(element)];
    if (element.type === 'frame' && element.name) {
      const titleWidth = Math.max(16, String(element.name).length * 16);
      content.push({
        left: finite(element.x) + 10,
        right: finite(element.x) + 10 + titleWidth,
        top: finite(element.y) - 28,
        bottom: finite(element.y)
      });
    }
    return content;
  });
  const left = Math.min(...bounds.map((item) => item.left)) - padding;
  const right = Math.max(...bounds.map((item) => item.right)) + padding;
  const top = Math.min(...bounds.map((item) => item.top)) - padding;
  const bottom = Math.max(...bounds.map((item) => item.bottom)) + padding;
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function strokeDasharray(element) {
  if (element.strokeStyle === 'dashed') return '10 7';
  if (element.strokeStyle === 'dotted') return '3 6';
  return null;
}

function commonStyle(element) {
  const stroke = element.strokeColor === 'transparent' ? 'none' : (element.strokeColor ?? '#1f2937');
  const fill = element.backgroundColor === 'transparent' ? 'none' : (element.backgroundColor ?? 'none');
  const opacity = Math.max(0, Math.min(1, finite(element.opacity, 100) / 100));
  const dash = strokeDasharray(element);
  return [
    `stroke="${escapeXml(stroke)}"`,
    `fill="${escapeXml(fill)}"`,
    `stroke-width="${finite(element.strokeWidth, 1)}"`,
    `opacity="${opacity}"`,
    dash ? `stroke-dasharray="${dash}"` : null,
    'vector-effect="non-scaling-stroke"'
  ].filter(Boolean).join(' ');
}

function renderRect(element) {
  const rx = element.roundness ? 10 : 0;
  return `<rect x="${finite(element.x)}" y="${finite(element.y)}" width="${finite(element.width)}" height="${finite(element.height)}" rx="${rx}" ${commonStyle(element)} />`;
}

function renderEllipse(element) {
  const cx = finite(element.x) + finite(element.width) / 2;
  const cy = finite(element.y) + finite(element.height) / 2;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(finite(element.width)) / 2}" ry="${Math.abs(finite(element.height)) / 2}" ${commonStyle(element)} />`;
}

function absolutePoints(element) {
  const x = finite(element.x);
  const y = finite(element.y);
  const points = Array.isArray(element.points) ? element.points : [[0, 0], [finite(element.width), finite(element.height)]];
  return points.map(([px, py]) => ({ x: x + finite(px), y: y + finite(py) }));
}

function renderPolyline(element) {
  const points = absolutePoints(element).map((point) => `${point.x},${point.y}`).join(' ');
  const marker = element.type === 'arrow' && element.endArrowhead ? ' marker-end="url(#arrowhead)"' : '';
  return `<polyline points="${points}" ${commonStyle({ ...element, backgroundColor: 'transparent' })}${marker} />`;
}

function renderText(element) {
  const lines = String(element.text ?? element.originalText ?? '').split('\n');
  const size = finite(element.fontSize, 18);
  const lineHeight = finite(element.lineHeight, 1.25) * size;
  const align = element.textAlign === 'center' ? 'middle' : element.textAlign === 'right' ? 'end' : 'start';
  const baseX = element.textAlign === 'center'
    ? finite(element.x) + finite(element.width) / 2
    : element.textAlign === 'right'
      ? finite(element.x) + finite(element.width)
      : finite(element.x);
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const startY = finite(element.y) + Math.max(size, (finite(element.height, totalHeight) - totalHeight) / 2 + size);
  const family = element.fontFamily === 3 ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Inter, Arial, sans-serif';
  const fill = element.strokeColor ?? '#1f2937';
  const tspans = lines.map((line, index) => `<tspan x="${baseX}" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>`).join('');
  return `<text text-anchor="${align}" font-family="${family}" font-size="${size}" fill="${escapeXml(fill)}" opacity="${Math.max(0, Math.min(1, finite(element.opacity, 100) / 100))}">${tspans}</text>`;
}

function renderFrameTitle(element) {
  if (element.type !== 'frame' || !element.name) return '';
  return `<text x="${finite(element.x) + 10}" y="${finite(element.y) - 12}" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="600" fill="#475569">${escapeXml(element.name)}</text>`;
}

function renderElement(element) {
  if (!element || element.isDeleted) return '';
  if (element.type === 'rectangle' || element.type === 'frame') return `${renderRect(element)}${renderFrameTitle(element)}`;
  if (element.type === 'ellipse') return renderEllipse(element);
  if (element.type === 'line' || element.type === 'arrow') return renderPolyline(element);
  if (element.type === 'text') return renderText(element);
  return '';
}

export function exportPreviewSvg(scene) {
  const elements = Array.isArray(scene?.elements) ? scene.elements : [];
  const bounds = sceneBounds(elements);
  const background = scene?.appState?.viewBackgroundColor ?? '#ffffff';
  const body = elements.map(renderElement).filter(Boolean).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}">
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
    </marker>
  </defs>
  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${escapeXml(background)}" />
${body}
</svg>\n`;
}

function main() {
  const [scenePathArg, flag, outputPathArg] = process.argv.slice(2);
  if (!scenePathArg) {
    console.error('Usage: node src/export-preview-svg.mjs <scene.excalidraw> [-o preview.svg]');
    process.exit(1);
  }
  const scenePath = path.resolve(process.cwd(), scenePathArg);
  const outputPath = flag === '-o' && outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : `${scenePath}.preview.svg`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, exportPreviewSvg(readJson(scenePath)), 'utf8');
  console.log(path.relative(process.cwd(), outputPath) || outputPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
