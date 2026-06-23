import { describe, expect, it } from "vitest";
import { getAccessIdentity, normalizeVisitorRegistration, validateRecordPayload } from "../functions/api/_shared.js";

describe("API shared helpers", () => {
  it("recognizes Cloudflare Access admin emails", () => {
    const request = new Request("https://hub.3hk.xyz/api/session", {
      headers: { "Cf-Access-Authenticated-User-Email": "ops@3hk.xyz" },
    });
    const identity = getAccessIdentity(request, { ADMIN_EMAILS: "ops@3hk.xyz" });
    expect(identity.admin).toBe(true);
  });

  it("normalizes opportunity money and probability", () => {
    const payload = validateRecordPayload(
      {
        id: "o1",
        sourceCompanyId: "c1",
        targetCompanyId: "c2",
        opportunityType: "采购",
        estimatedValue: "100.5",
        expectedValue: "40.4",
        probability: 2,
        confidence: -1,
      },
      "opportunity",
    );
    expect(payload.estimatedValue).toBe(101);
    expect(payload.probability).toBe(1);
    expect(payload.confidence).toBe(0);
  });

  it("normalizes visitor registration emails and fields", () => {
    const payload = normalizeVisitorRegistration({
      email: "  Visitor@Example.COM ",
      name: "  Ada   Wong  ",
      organization: "  3HK   Capital  ",
      interest: "跨境资本",
    });
    expect(payload).toEqual({
      email: "visitor@example.com",
      name: "Ada Wong",
      organization: "3HK Capital",
      interest: "跨境资本",
    });
  });

  it("rejects invalid visitor registration emails", () => {
    expect(() => normalizeVisitorRegistration({ email: "not-an-email" })).toThrow("Valid email is required");
  });
});
