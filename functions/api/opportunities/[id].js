import { itemRequest } from "../_records.js";

export function onRequest(context) {
  return itemRequest(context, "opportunity");
}
