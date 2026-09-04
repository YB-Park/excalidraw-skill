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

function resolveExportScale(scene) {
  if (Number.isFinite(scene.appState?.exportScale) && scene.appState.exportScale > 0) {
    return scene.appState.exportScale;
  }
  return [1, 2, 3].includes(window.devicePixelRatio) ? window.devicePixelRatio : 1;
}

async function renderScene() {
  const scene = window.__EXCALIDRAW_SCENE__;
  if (!scene || !Array.isArray(scene.elements)) {
    throw new Error('window.__EXCALIDRAW_SCENE__ was not provided');
  }

  const elements = scene.elements.filter((element) => !element.isDeleted);
  const fontsBeforeExport = snapshotFonts();
  const exportScale = resolveExportScale(scene);

  // Mirror the Excalidraw app's PNG path while staying on the public API:
  // - exportToBlob restores/defaults appState and loads scene fonts
  // - getDimensions reproduces scene/exportToCanvas's appState.exportScale canvas
  // - omitted exportPadding keeps Excalidraw's native 10px default
  // - persist the returned PNG blob itself, never a screenshot of a decoded <img>
  const blob = await exportToBlob({
    elements,
    appState: scene.appState ?? {},
    files: scene.files ?? {},
    mimeType: 'image/png',
    getDimensions(width, height) {
      return {
        width: width * exportScale,
        height: height * exportScale,
        scale: exportScale
      };
    }
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
    dimensionMode: 'native-export-scale',
    exportScale,
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
