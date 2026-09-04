import { exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

function snapshotFonts() {
  if (!document.fonts) return { supported: false, faces: [], checks: {} };
  const samples = {
    latin: 'ABC 123 Diagram',
    korean: '한글 폰트 확인'
  };
  const families = ['Helvetica', 'Cascadia', 'Excalifont', 'Xiaolai', 'Liberation Sans', 'Nunito', 'Comic Shanns'];
  const checks = {};
  for (const family of families) {
    checks[family] = {
      latin: document.fonts.check(`28px "${family}"`, samples.latin),
      korean: document.fonts.check(`28px "${family}"`, samples.korean)
    };
  }
  return {
    supported: true,
    faces: Array.from(document.fonts).map((face) => ({
      family: face.family,
      status: face.status,
      style: face.style,
      weight: face.weight,
      unicodeRange: face.unicodeRange
    })),
    checks
  };
}

function fontResources() {
  return performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /\.(?:woff2?|ttf|otf)(?:$|\?)/i.test(name));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read exported PNG blob'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function renderScene() {
  const scene = window.__EXCALIDRAW_SCENE__;
  if (!scene || !Array.isArray(scene.elements)) {
    throw new Error('window.__EXCALIDRAW_SCENE__ was not provided');
  }

  const elements = scene.elements.filter((element) => !element.isDeleted);
  const fontsBeforeExport = snapshotFonts();

  // Keep this path intentionally close to Excalidraw's native export utility:
  // - let exportToBlob restore/default appState itself
  // - use the native 1:1 dimensions (no custom getDimensions down-scaling)
  // - use Excalidraw's default export padding (10px)
  // The blob returned here is the artifact we persist. Do not screenshot an
  // <img> containing it, because that introduces a second browser raster pass.
  const blob = await exportToBlob({
    elements,
    appState: scene.appState ?? {},
    files: scene.files ?? {},
    mimeType: 'image/png'
  });

  if (document.fonts?.ready) await document.fonts.ready;
  const fontsAfterExport = snapshotFonts();
  const dataUrl = await blobToDataUrl(blob);

  const image = new Image();
  image.id = 'rendered';
  image.alt = 'Rendered Excalidraw scene';
  image.src = dataUrl;
  await image.decode();
  document.getElementById('root').appendChild(image);

  window.__EXCALIDRAW_RENDER_PNG_DATA_URL__ = dataUrl;
  window.__EXCALIDRAW_RENDER_READY__ = {
    width: image.naturalWidth,
    height: image.naturalHeight,
    elements: elements.length,
    captureMode: 'export-blob',
    dimensionMode: 'native-1x',
    exportPadding: 10,
    fontDiagnostics: {
      beforeExport: fontsBeforeExport,
      afterExport: fontsAfterExport,
      resources: fontResources()
    }
  };
}

renderScene().catch((error) => {
  window.__EXCALIDRAW_RENDER_ERROR__ = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(error);
});
