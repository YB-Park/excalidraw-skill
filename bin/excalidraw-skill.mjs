#!/usr/bin/env node

const command = process.argv[2] ?? 'help';

const commands = [
  'doctor',
  'init',
  'list-shapes',
  'render',
  'inspect',
  'patch',
  'validate'
];

function printUsage() {
  console.log('Usage: excalidraw-skill <command>');
  console.log('');
  console.log('Commands:');
  for (const item of commands) console.log(`  - ${item}`);
}

if (command === 'doctor') {
  console.log('excalidraw-skill doctor: scaffold');
  console.log(`node: ${process.version}`);
  process.exit(0);
}

if (command === 'init') {
  console.log('excalidraw-skill init: scaffold');
  console.log('setup behavior will be implemented in a later iteration');
  process.exit(0);
}

if (command === 'list-shapes') {
  console.log('Shape catalog: skills/excalidraw-skill/catalog/shapes.index.json');
  process.exit(0);
}

if (['render', 'inspect', 'patch', 'validate'].includes(command)) {
  console.log(`excalidraw-skill ${command}: planned`);
  console.log('This command is part of the CLI contract but is not implemented yet.');
  process.exit(0);
}

printUsage();
