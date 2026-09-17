import { describe, it, expect } from "vitest";
import { collectionRequest, itemRequest } from "../functions/api/_records.js";
import { onRequest as exportDataset } from "../functions/api/export.js";

const company = { id: "c1", name: "Company", countryRegion: "中国大陆", revenue: 0, contactName: "Private Name", contactTitle: "Director", phone: "+86 13800138000", email: "private@example.test", website: "example.test", address: "Private Address", cardNotes: "Private card text" };
const advisor = { ...company, id: "a1", name: "Advisor", title: "Consultant", organization: "Company" };
const DB = { prepare(sql) {
  const record = sql.includes("advisors") ? advisor : company;
  return { async all() { return { results: sql.includes("opportunities") ? [] : [{ payload: JSON.stringify(record) }] }; }, async first() { return sql.includes("rule_config") ? null : { payload: JSON.stringify(record) }; }, bind() { return this; } };
} };
function context(admin, id = "c1") {
  return { request: new Request("https://hub.3hk.xyz/api/companies", { headers: admin ? { "Cf-Access-Authenticated-User-Email": "admin@example.test" } : {} }), env: { DB, ADMIN_EMAILS: "admin@example.test" }, params: { id } };
}
function privateFields(record, admin) {
  for (const field of ["contactName", "contactTitle", "phone", "email", "website", "address", "cardNotes"]) {
    if (admin) expect(record[field]).toBe(company[field]);
    else expect(record).not.toHaveProperty(field);
  }
}
describe("business card read permissions", () => {
  for (const admin of [false, true]) {
    it(`collection and item reads ${admin ? "retain" : "remove"} private contact fields`, async () => {
      for (const type of ["company", "advisor"]) {
        const collection = await (await collectionRequest(context(admin), type)).json();
        privateFields(collection.items[0], admin);
        const item = await (await itemRequest(context(admin), type)).json();
        privateFields(item, admin);
      }
    });
    it(`dataset export ${admin ? "retains" : "removes"} private contact fields`, async () => {
      const dataset = await (await exportDataset(context(admin))).json();
      privateFields(dataset.companies[0], admin); privateFields(dataset.advisors[0], admin);
      expect(company.phone).toBe("+86 13800138000");
    });
  }
});
