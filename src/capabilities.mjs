#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'skills/excalidraw-skill/capabilities.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
console.log(JSON.stringify(data, null, 2));
