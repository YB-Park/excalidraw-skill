import { createQualityReport } from './quality-report.mjs';
import { createPerceptualQuality } from './perceptual-quality.mjs';

export function scoreLayoutCandidate(scene, spec, options = {}) {
  const quality = createQualityReport(scene, spec);
  const perceptual = createPerceptualQuality(scene, spec);
  const metrics = quality.metrics;
  const hardCrossingLimit = options.hardCrossingLimit ?? 2;
  const aspectHardLimit = options.aspectHardLimit ?? 8;
  const aspectSoftLimit = options.aspectSoftLimit ?? 5;

  const hardViolations = {
    nodeOverlaps: metrics.nodeOverlaps ?? 0,
    edgeNodeCrossings: metrics.edgeNodeCrossings ?? 0,
    endpointOverlaps: metrics.endpointOverlaps ?? 0,
    endpointApproachViolations: metrics.endpointApproachViolations ?? 0,
    labelNodeOverlaps: metrics.labelNodeOverlaps ?? 0,
    textOverflows: metrics.textOverflows ?? 0,
    edgeVisualMismatches: metrics.edgeVisualMismatches ?? 0,
    unresolvedFrameCollisions: metrics.unresolvedFrameCollisions ?? 0,
    excessiveEdgeCrossings: Math.max(0, (metrics.edgeCrossings ?? 0) - hardCrossingLimit),
    excessiveAspectRatio: Math.max(0, (metrics.aspectRatio ?? 1) - aspectHardLimit),
    familyFailure: quality.familyPass ? 0 : 1
  };

  const hardPenalty = hardViolations.nodeOverlaps * 1_000_000
    + hardViolations.edgeNodeCrossings * 1_000_000
    + hardViolations.endpointOverlaps * 750_000
    + hardViolations.endpointApproachViolations * 750_000
    + hardViolations.labelNodeOverlaps * 250_000
    + hardViolations.textOverflows * 250_000
    + hardViolations.edgeVisualMismatches * 200_000
    + hardViolations.unresolvedFrameCollisions * 500_000
    + hardViolations.excessiveEdgeCrossings * 1_000_000
    + (hardViolations.excessiveAspectRatio > 0 ? 1_000_000 + hardViolations.excessiveAspectRatio * 10_000 : 0)
    + hardViolations.familyFailure * 1_000_000;

  const aspectPenalty = Math.max(0, (metrics.aspectRatio ?? 1) - aspectSoftLimit) * 12;
  const perceptualCost = perceptual.metrics.readabilityCost ?? 0;
  const totalCost = hardPenalty + aspectPenalty + perceptualCost;

  return {
    cost: Number(totalCost.toFixed(2)),
    hardPenalty: Number(hardPenalty.toFixed(2)),
    hardPass: hardPenalty === 0,
    aspectPenalty: Number(aspectPenalty.toFixed(2)),
    perceptualCost: Number(perceptualCost.toFixed(2)),
    hardViolations,
    quality,
    perceptual
  };
}
