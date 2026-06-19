#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderSequenceSpec } from './sequence-renderer.mjs';

const [specArg, flag, outputArg] = process.argv.slice(2);
try {
  if (!specArg) throw new Error('Usage: render-sequence <spec.json> [-o output.excalidraw]');
  const spec = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), specArg), 'utf8'));
  const output = flag === '-o' && outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(process.cwd(), spec.outputPath ?? 'sequence.excalidraw');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(renderSequenceSpec(spec), null, 2)}\n`);
  console.log(path.relative(process.cwd(), output) || output);
} catch (error) {
  console.error(`render-sequence failed: ${error.message}`);
  process.exit(1);
}
