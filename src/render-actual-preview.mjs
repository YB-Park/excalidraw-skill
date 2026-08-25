#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, '..');
const harnessDir = path.join(rootDir, 'visual-harness');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(args) {
  const scenePath = args[0];
  let outputPath = null;
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '-o' || args[index] === '--output') outputPath = args[++index] ?? null;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!scenePath) throw new Error('Usage: node src/render-actual-preview.mjs <scene.excalidraw> [-o output.png]');
  return {
    scenePath: path.resolve(process.cwd(), scenePath),
    outputPath: path.resolve(process.cwd(), outputPath ?? `${scenePath}.actual.png`)
  };
}

function copyFonts() {
  const source = path.join(rootDir, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
  const destination = path.join(harnessDir, 'public/fonts');
  if (!fs.existsSync(source)) throw new Error('Excalidraw fonts were not installed. Run npm install first.');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

async function render(scene, outputPath) {
  copyFonts();
  const server = await createServer({
    root: harnessDir,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 }
  });
  await server.listen();
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : null;
  if (!port) throw new Error('Visual harness did not expose a local port');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1900, height: 1300 }, deviceScaleFactor: 1 });
    await page.addInitScript((value) => {
      window.__EXCALIDRAW_SCENE__ = value;
    }, scene);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__EXCALIDRAW_RENDER_READY__ || window.__EXCALIDRAW_RENDER_ERROR__, null, { timeout: 30000 });
    const renderError = await page.evaluate(() => window.__EXCALIDRAW_RENDER_ERROR__ ?? null);
    if (renderError) throw new Error(renderError);
    const metadata = await page.evaluate(() => window.__EXCALIDRAW_RENDER_READY__);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.locator('#rendered').screenshot({ path: outputPath, animations: 'disabled' });
    fs.writeFileSync(`${outputPath}.json`, `${JSON.stringify({
      renderer: '@excalidraw/excalidraw',
      ...metadata
    }, null, 2)}\n`);
    return metadata;
  } finally {
    await browser.close();
    await server.close();
    fs.rmSync(path.join(harnessDir, 'public/fonts'), { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scene = readJson(options.scenePath);
  const metadata = await render(scene, options.outputPath);
  console.log(JSON.stringify({
    outputPath: path.relative(process.cwd(), options.outputPath) || options.outputPath,
    ...metadata
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`render-actual-preview failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
