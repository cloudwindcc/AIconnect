import { describe, expect, it } from "vitest";
import { applyNetworkMetrics, companyRadius, computeNetworkMetrics, linkWidth } from "../src/domain/metrics.js";

describe("Hub metrics", () => {
  it("scales company radius by revenue", () => {
    expect(companyRadius(50_000_000)).toBeLessThan(companyRadius(1_000_000_000));
    expect(companyRadius(1_000_000_000)).toBeLessThan(companyRadius(16_000_000_000));
  });

  it("scales link width by estimated opportunity value", () => {
    expect(linkWidth(300_000)).toBeLessThan(linkWidth(30_000_000));
    expect(linkWidth(30_000_000)).toBeLessThan(linkWidth(300_000_000));
  });

  it("computes hub score and bridge score", () => {
    const companies = [{ id: "c1" }, { id: "c2" }];
    const advisors = [{ id: "a1" }];
    const opportunities = [
      {
        id: "o1",
        sourceCompanyId: "c1",
        targetCompanyId: "c2",
        advisorId: "a1",
        opportunityType: "渠道出海",
        expectedValue: 10_000_000,
      },
    ];
    const metrics = computeNetworkMetrics({ companies, advisors, opportunities, advisorLinks: [] });
    expect(metrics.get("c1").hubScore).toBeGreaterThan(0);
    expect(metrics.get("c1").bridgeScore).toBeGreaterThan(1);
    expect(opportunities[0].expectedValueRank).toBe(1);
  });

  it("applies metrics to nodes and opportunities", () => {
    const dataset = {
      companies: [{ id: "c1" }, { id: "c2" }],
      advisors: [],
      opportunities: [{ id: "o1", sourceCompanyId: "c1", targetCompanyId: "c2", opportunityType: "采购", expectedValue: 1 }],
      advisorLinks: [],
    };
    applyNetworkMetrics(dataset);
    expect(dataset.companies[0].hubScore).toBeGreaterThan(0);
    expect(dataset.opportunities[0].hubScore).toBeGreaterThan(0);
  });
});
