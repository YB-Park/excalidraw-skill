#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(rootDir, 'skills/excalidraw-skill/contracts/diagram-spec-v2.schema.json');
console.log(fs.readFileSync(schemaPath, 'utf8'));
