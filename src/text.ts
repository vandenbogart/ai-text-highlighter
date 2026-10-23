const INVISIBLE = /[\u200B-\u200F\u2060\uFEFF\u00AD]/g;

export function normalize(text: string): string {
  return text.normalize("NFKC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

export async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
