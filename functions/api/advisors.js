import { collectionRequest } from "./_records.js";

export function onRequest(context) {
  return collectionRequest(context, "advisor");
}
