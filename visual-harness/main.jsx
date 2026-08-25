import { exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

async function renderScene() {
  const scene = window.__EXCALIDRAW_SCENE__;
  if (!scene || !Array.isArray(scene.elements)) {
    throw new Error('window.__EXCALIDRAW_SCENE__ was not provided');
  }

  if (document.fonts?.ready) await document.fonts.ready;
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

  const image = new Image();
  image.id = 'rendered';
  image.alt = 'Rendered Excalidraw scene';
  image.src = URL.createObjectURL(blob);
  await image.decode();
  document.getElementById('root').appendChild(image);
  window.__EXCALIDRAW_RENDER_READY__ = {
    width: image.naturalWidth,
    height: image.naturalHeight,
    elements: scene.elements.filter((element) => !element.isDeleted).length
  };
}

renderScene().catch((error) => {
  window.__EXCALIDRAW_RENDER_ERROR__ = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(error);
});
