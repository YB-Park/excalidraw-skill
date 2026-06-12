#!/usr/bin/env node

const command = process.argv[2] ?? 'help';

if (command === 'doctor') {
  console.log('excalidraw-skill doctor: scaffold');
  console.log(`node: ${process.version}`);
  process.exit(0);
}

if (command === 'init') {
  console.log('excalidraw-skill init: scaffold');
  console.log('installer behavior will be implemented in a later iteration');
  process.exit(0);
}

console.log('Usage: excalidraw-skill <doctor|init>');
