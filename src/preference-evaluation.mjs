function pairOrder(ranking) {
  const order = new Map(ranking.map((id, index) => [id, index]));
  const pairs = [];
  for (let i = 0; i < ranking.length; i += 1) {
    for (let j = i + 1; j < ranking.length; j += 1) pairs.push([ranking[i], ranking[j], order]);
  }
  return pairs;
}

function pairAgreement(reference, candidate) {
  const candidateOrder = new Map(candidate.map((id, index) => [id, index]));
  const pairs = pairOrder(reference);
  if (pairs.length === 0) return 1;
  let matches = 0;
  for (const [left, right] of pairs) {
    if (!candidateOrder.has(left) || !candidateOrder.has(right)) continue;
    if (candidateOrder.get(left) < candidateOrder.get(right)) matches += 1;
  }
  return matches / pairs.length;
}

export function evaluatePreferenceRecords(records) {
  let runs = 0;
  let top1Matches = 0;
  let pairAgreementTotal = 0;
  let escalations = 0;
  let stableCases = 0;
  let evaluatedCases = 0;

  for (const record of records ?? []) {
    const humanRanking = record.humanRanking ?? [];
    const criticRuns = record.criticRuns ?? [];
    if (humanRanking.length === 0 || criticRuns.length === 0) continue;
    evaluatedCases += 1;
    const topChoices = new Set();
    for (const run of criticRuns) {
      const ranking = run.ranking ?? [];
      if (ranking.length === 0) continue;
      runs += 1;
      topChoices.add(ranking[0]);
      if (ranking[0] === humanRanking[0]) top1Matches += 1;
      pairAgreementTotal += pairAgreement(humanRanking, ranking);
      if (run.humanDecisionRecommended === true) escalations += 1;
    }
    if (topChoices.size <= 1) stableCases += 1;
  }

  return {
    cases: evaluatedCases,
    runs,
    top1Agreement: runs === 0 ? null : Number((top1Matches / runs).toFixed(3)),
    pairwiseAgreement: runs === 0 ? null : Number((pairAgreementTotal / runs).toFixed(3)),
    top1Stability: evaluatedCases === 0 ? null : Number((stableCases / evaluatedCases).toFixed(3)),
    humanEscalationRate: runs === 0 ? null : Number((escalations / runs).toFixed(3))
  };
}
