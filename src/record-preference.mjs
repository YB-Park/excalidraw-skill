#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--human-confirmed') {
      args.humanConfirmed = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function candidateIdsFromManifest(manifest) {
  const candidates = Array.isArray(manifest?.blindCandidates)
    ? manifest.blindCandidates
    : Array.isArray(manifest?.candidates)
      ? manifest.candidates
      : [];
  return candidates
    .map((candidate) => candidate?.candidateId)
    .filter((id) => typeof id === 'string');
}

export function recordPreference({ corpus, manifest, scenario, ranking, note = null, humanConfirmed, timestamp = new Date().toISOString(), manifestPath = null }) {
  if (humanConfirmed !== true) {
    throw new Error('Refusing to record preference without --human-confirmed after a person inspected the actual candidate images');
  }
  if (!scenario || typeof scenario !== 'string') throw new Error('scenario is required');
  if (!Array.isArray(ranking) || ranking.length < 2) throw new Error('ranking must contain at least two candidate IDs');
  if (new Set(ranking).size !== ranking.length) throw new Error('ranking must not contain duplicate candidate IDs');

  const available = candidateIdsFromManifest(manifest);
  if (available.length < 2) throw new Error('manifest must expose at least two opaque candidate IDs');
  if (ranking.length !== available.length || ranking.some((id) => !available.includes(id))) {
    throw new Error(`ranking must contain every manifest candidate ID exactly once: ${available.join(',')}`);
  }
  if (ranking.some((id) => !/^c\d{2}$/.test(id))) {
    throw new Error('preference ranking must use opaque candidate IDs such as c01/c02/c03');
  }

  const next = structuredClone(corpus);
  if (next?.version !== '1.0' || !Array.isArray(next?.cases)) throw new Error('unsupported preference corpus format');
  next.cases.push({
    scenario,
    ranking,
    source: 'human',
    humanConfirmed: true,
    inspectedActualImages: true,
    timestamp,
    ...(manifestPath ? { manifestPath } : {}),
    ...(note ? { note } : {})
  });
  return next;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const corpusPath = path.resolve(process.cwd(), args.corpus ?? 'examples/evaluation/preference-corpus.json');
  const manifestPath = args.manifest ? path.resolve(process.cwd(), args.manifest) : null;
  if (!manifestPath) throw new Error('--manifest is required');
  if (!args.scenario) throw new Error('--scenario is required');
  if (!args.ranking) throw new Error('--ranking is required');

  const corpus = readJson(corpusPath);
  const manifest = readJson(manifestPath);
  const ranking = args.ranking.split(',').map((value) => value.trim()).filter(Boolean);
  const next = recordPreference({
    corpus,
    manifest,
    scenario: args.scenario,
    ranking,
    note: args.note ?? null,
    humanConfirmed: args.humanConfirmed === true,
    manifestPath: path.relative(process.cwd(), manifestPath)
  });
  writeJson(corpusPath, next);
  console.log(`${path.relative(process.cwd(), corpusPath) || corpusPath}: recorded human ranking ${ranking.join(' > ')}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`record-preference failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
