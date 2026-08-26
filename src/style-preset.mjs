import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..');
const presetDir = path.join(packageRoot, 'assets', 'styles');
const cache = new Map();
const EDGE_STROKES = new Set(['solid', 'dashed', 'dotted']);

export const DEFAULT_STYLE_PRESET = 'professional-software';

function assertPresetName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/u.test(name)) {
    throw new Error(`Invalid style preset: ${String(name)}`);
  }
  return name;
}

function assertRuntimePreset(preset, name) {
  const requiredObjects = ['base', 'roles', 'edgeKinds', 'edgeVisualRoles', 'edgeEmphasis'];
  for (const key of requiredObjects) {
    if (!preset?.[key] || typeof preset[key] !== 'object' || Array.isArray(preset[key])) {
      throw new Error(`Style preset ${name} is missing runtime section: ${key}`);
    }
  }
  if (!preset.roles.service) throw new Error(`Style preset ${name} is missing service role`);
  if (!preset.edgeVisualRoles.default) throw new Error(`Style preset ${name} is missing default edge visual role`);
  if (!preset.edgeEmphasis.normal) throw new Error(`Style preset ${name} is missing normal edge emphasis`);
  return preset;
}

export function loadStylePreset(name = DEFAULT_STYLE_PRESET) {
  const presetName = assertPresetName(name ?? DEFAULT_STYLE_PRESET);
  if (cache.has(presetName)) return cache.get(presetName);
  const filePath = path.join(presetDir, `${presetName}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Unsupported style preset: ${presetName}`);
  const preset = assertRuntimePreset(JSON.parse(fs.readFileSync(filePath, 'utf8')), presetName);
  if (preset.name !== presetName) throw new Error(`Style preset name mismatch: expected ${presetName}, got ${preset.name ?? 'none'}`);
  cache.set(presetName, preset);
  return preset;
}

export function presetNameForScene(scene, fallback = DEFAULT_STYLE_PRESET) {
  return scene?.customData?.excalidrawSkill?.stylePreset ?? fallback;
}

function resolvePreset(presetOrName = DEFAULT_STYLE_PRESET) {
  if (typeof presetOrName === 'string' || presetOrName == null) {
    return loadStylePreset(presetOrName ?? DEFAULT_STYLE_PRESET);
  }
  return assertRuntimePreset(presetOrName, presetOrName.name ?? 'inline');
}

export function baseElementStyle(presetOrName = DEFAULT_STYLE_PRESET) {
  return resolvePreset(presetOrName).base;
}

export function roleFor(shapeRef = '') {
  if (shapeRef.includes('actor')) return 'actor';
  if (shapeRef.includes('client')) return 'client';
  if (shapeRef.includes('gateway')) return 'gateway';
  if (shapeRef.includes('worker')) return 'worker';
  if (shapeRef.includes('database') || shapeRef.includes('storage')) return 'data';
  if (shapeRef.includes('cache')) return 'cache';
  if (shapeRef.includes('queue')) return 'queue';
  if (shapeRef.includes('external')) return 'external';
  if (shapeRef.includes('risk') || shapeRef.includes('security')) return 'risk';
  if (shapeRef.includes('state') || shapeRef.includes('domain') || shapeRef.includes('process')) return 'model';
  if (shapeRef.includes('boundary') || shapeRef.includes('cloud') || shapeRef.includes('network') || shapeRef.includes('k8s')) return 'boundary';
  return 'service';
}

export function nodeStyleFor(shapeRef = '', presetOrName = DEFAULT_STYLE_PRESET) {
  const preset = resolvePreset(presetOrName);
  return preset.roles[roleFor(shapeRef)] ?? preset.roles.service;
}

export function edgeKindStyleFor(kind, presetOrName = DEFAULT_STYLE_PRESET) {
  return resolvePreset(presetOrName).edgeKinds[kind] ?? null;
}

export function normalizeEdgeVisual(visualCandidate, presetOrName = DEFAULT_STYLE_PRESET) {
  const preset = resolvePreset(presetOrName);
  const visual = visualCandidate && typeof visualCandidate === 'object' ? visualCandidate : {};
  return {
    role: preset.edgeVisualRoles[visual.role] ? visual.role : 'default',
    emphasis: preset.edgeEmphasis[visual.emphasis] ? visual.emphasis : 'normal',
    stroke: EDGE_STROKES.has(visual.stroke) ? visual.stroke : undefined
  };
}

export function edgeVisualStyleFor(visualCandidate, presetOrName = DEFAULT_STYLE_PRESET) {
  const preset = resolvePreset(presetOrName);
  const visual = normalizeEdgeVisual(visualCandidate, preset);
  const roleStyle = preset.edgeVisualRoles[visual.role] ?? preset.edgeVisualRoles.default;
  const emphasisStyle = preset.edgeEmphasis[visual.emphasis] ?? preset.edgeEmphasis.normal;
  return {
    visual,
    style: {
      strokeColor: emphasisStyle.strokeColor ?? roleStyle.strokeColor,
      strokeWidth: emphasisStyle.strokeWidth ?? Math.max(1, roleStyle.strokeWidth + (emphasisStyle.strokeWidthDelta ?? 0)),
      strokeStyle: visual.stroke ?? emphasisStyle.strokeStyle ?? roleStyle.strokeStyle,
      opacity: emphasisStyle.opacity ?? roleStyle.opacity
    }
  };
}
