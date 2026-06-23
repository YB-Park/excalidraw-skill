#!/usr/bin/env node

const topic = process.argv[2] ?? 'overview';

const pages = {
  overview: 'Use build for new diagrams. Use inspect then patch for existing diagrams. Use quality-report after generation.',
  visual: 'Use edge.visual with role, emphasis, and stroke. These semantic fields are converted to final Excalidraw edge styles and override kind defaults.',
  frames: 'Groups and lanes are invisible by default. Visible frames require explicit visualBoundary, forceFrame, or framePolicy.include. The renderer suppresses redundant frames.',
  layout: 'Use layout profile, direction, aspectRatio, primaryFlow, lanes, and layoutHints. For swimlane-flow, centerAxisX and centerAxisY anchor the center lane.'
};

if (!pages[topic]) {
  console.error('Unknown topic. Available topics: overview, visual, frames, layout');
  process.exit(1);
}

console.log(pages[topic]);
