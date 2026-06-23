#!/usr/bin/env node

console.error('Warning: bin/excalidraw-skills.mjs is a compatibility alias. Prefer bin/excalidraw-skill.mjs or the marker runtimeEntry path.');
await import('./excalidraw-skill.mjs');
