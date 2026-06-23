export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function companyRadius(revenue) {
  const value = Math.max(0, Number(revenue) || 0);
  if (!value) return 8;
  const min = Math.log10(50_000_000);
  const max = Math.log10(16_000_000_000);
  const ratio = clamp((Math.log10(value) - min) / (max - min), 0, 1);
  return Math.round((8 + ratio * 14) * 10) / 10;
}

export function linkWidth(estimatedValue) {
  const value = Math.max(0, Number(estimatedValue) || 0);
  if (!value) return 1.2;
  const min = Math.log10(300_000);
  const max = Math.log10(300_000_000);
  const ratio = clamp((Math.log10(value) - min) / (max - min), 0, 1);
  return Math.round((1.2 + ratio * 5.8) * 10) / 10;
}

export function computeNetworkMetrics({ companies = [], advisors = [], opportunities = [], advisorLinks = [] }) {
  const metrics = new Map();
  [...companies, ...advisors].forEach((node) => {
    metrics.set(node.id, {
      id: node.id,
      degree: 0,
      weightedOpportunityValue: 0,
      bridgeScore: 0,
      advisorBridgeCoverage: 0,
      expectedValueRank: null,
      hubScore: 0,
    });
  });

  opportunities.forEach((opportunity) => {
    const value = Number(opportunity.expectedValue || opportunity.estimatedValue || 0);
    for (const id of [opportunity.sourceCompanyId, opportunity.targetCompanyId, opportunity.advisorId].filter(Boolean)) {
      const metric = metrics.get(id);
      if (!metric) continue;
      metric.degree += 1;
      metric.weightedOpportunityValue += value;
    }
    const bridgeBonus = opportunity.opportunityType === "渠道出海" || opportunity.opportunityType === "香港上市" ? 2 : 1;
    [opportunity.sourceCompanyId, opportunity.targetCompanyId].filter(Boolean).forEach((id) => {
      const metric = metrics.get(id);
      if (metric) metric.bridgeScore += bridgeBonus;
    });
  });

  advisorLinks.forEach((link) => {
    const advisorMetric = metrics.get(link.sourceId);
    const companyMetric = metrics.get(link.targetId);
    if (advisorMetric) advisorMetric.advisorBridgeCoverage += Number(link.strength || 0.5);
    if (companyMetric) companyMetric.bridgeScore += Number(link.strength || 0.5);
  });

  const ranked = [...opportunities].sort((a, b) => Number(b.expectedValue || 0) - Number(a.expectedValue || 0));
  ranked.forEach((opportunity, index) => {
    opportunity.expectedValueRank = index + 1;
  });

  const maxDegree = Math.max(1, ...[...metrics.values()].map((item) => item.degree));
  const maxValue = Math.max(1, ...[...metrics.values()].map((item) => item.weightedOpportunityValue));
  const maxBridge = Math.max(1, ...[...metrics.values()].map((item) => item.bridgeScore + item.advisorBridgeCoverage));

  metrics.forEach((metric) => {
    const centrality = metric.degree / maxDegree;
    const value = metric.weightedOpportunityValue / maxValue;
    const bridge = (metric.bridgeScore + metric.advisorBridgeCoverage) / maxBridge;
    metric.hubScore = Math.round((centrality * 42 + value * 38 + bridge * 20) * 10) / 10;
    metric.bridgeScore = Math.round(metric.bridgeScore * 10) / 10;
    metric.advisorBridgeCoverage = Math.round(metric.advisorBridgeCoverage * 10) / 10;
  });

  return metrics;
}

export function applyNetworkMetrics(dataset) {
  const metrics = computeNetworkMetrics(dataset);
  [...dataset.companies, ...dataset.advisors].forEach((node) => {
    node.networkMetrics = metrics.get(node.id) || null;
    node.hubScore = node.networkMetrics?.hubScore ?? 0;
    node.degree = node.networkMetrics?.degree ?? 0;
    node.bridgeScore = node.networkMetrics?.bridgeScore ?? 0;
  });
  dataset.opportunities.forEach((opportunity) => {
    const source = metrics.get(opportunity.sourceCompanyId);
    const target = metrics.get(opportunity.targetCompanyId);
    opportunity.hubScore = Math.round((((source?.hubScore || 0) + (target?.hubScore || 0)) / 2) * 10) / 10;
  });
  return dataset;
}
