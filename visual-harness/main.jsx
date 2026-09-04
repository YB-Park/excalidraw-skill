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

async function renderScene() {
  const scene = window.__EXCALIDRAW_SCENE__;
  if (!scene || !Array.isArray(scene.elements)) {
    throw new Error('window.__EXCALIDRAW_SCENE__ was not provided');
  }

  const fontsBeforeExport = snapshotFonts();
  const blob = await exportToBlob({
    elements: scene.elements.filter((element) => !element.isDeleted),
    appState: {
      ...(scene.appState ?? {}),
      exportBackground: true,
      exportWithDarkMode: false,
      viewBackgroundColor: '#ffffff'
    },
    files: scene.files ?? {},
    mimeType: 'image/png',
    exportPadding: 32,
    getDimensions(width, height) {
      const maxDimension = 1800;
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scale
      };
    }
  });
  if (document.fonts?.ready) await document.fonts.ready;
  const fontsAfterExport = snapshotFonts();

  const image = new Image();
  image.id = 'rendered';
  image.alt = 'Rendered Excalidraw scene';
  image.src = URL.createObjectURL(blob);
  await image.decode();
  document.getElementById('root').appendChild(image);
  window.__EXCALIDRAW_RENDER_READY__ = {
    width: image.naturalWidth,
    height: image.naturalHeight,
    elements: scene.elements.filter((element) => !element.isDeleted).length,
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
