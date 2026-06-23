const JSON_HEADERS = { "Content-Type": "application/json" };

export async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("API response was not JSON. Start Cloudflare Pages Functions for remote data.");
    }
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }
  return data;
}

export function getSession() {
  return requestJson("/api/session", { method: "GET" }).catch(() => ({ authenticated: false, admin: false }));
}

export function registerVisitor(payload) {
  return requestJson("/api/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loadDataset() {
  return requestJson("/api/export", { method: "GET" });
}

export function saveDataset(payload) {
  return requestJson("/api/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loadConfig() {
  return requestJson("/api/config", { method: "GET" });
}

export function saveConfig(payload) {
  return requestJson("/api/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
