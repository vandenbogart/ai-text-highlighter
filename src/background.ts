import type {
  InferRequest,
  InferResponse,
  ModelStatus,
  ScoreRequest,
  ScoreResponse,
  StatusRequest,
  StatusResponse,
} from "./messages";

const memory = new Map<string, number>();
const inflight = new Map<string, Promise<number | undefined>>();
let status: ModelStatus | null = null;
let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  creating ??= chrome.offscreen
    .createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "Run the bundled text classification model locally",
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

async function infer(texts: string[]): Promise<number[]> {
  await ensureOffscreen();
  const request: InferRequest = { target: "offscreen", type: "infer", texts };
  const response: InferResponse = await chrome.runtime.sendMessage(request);
  if (!response.ok) {
    throw new Error(response.error);
  }
  status = response.status;
  return response.scores;
}

async function score(items: ScoreRequest["items"]): Promise<ScoreResponse> {
  const scores: Record<string, number> = {};
  const unknown = items.filter(({ hash }) => {
    const cached = memory.get(hash);
    if (cached !== undefined) {
      scores[hash] = cached;
    }
    return cached === undefined;
  });

  const keys = unknown.map(({ hash }) => `score:${hash}`);
  const stored = keys.length > 0 ? await chrome.storage.local.get(keys) : {};
  const missing = unknown.filter(({ hash }) => {
    const value = stored[`score:${hash}`];
    if (typeof value === "number") {
      memory.set(hash, value);
      scores[hash] = value;
      return false;
    }
    return true;
  });

  const waiting = missing.filter(({ hash }) => inflight.has(hash));
  const fresh = missing.filter(({ hash }) => !inflight.has(hash));
  if (fresh.length > 0) {
    const run = infer(fresh.map(({ text }) => text));
    fresh.forEach(({ hash }, index) => {
      inflight.set(
        hash,
        run.then((values) => values[index]),
      );
    });
    try {
      const values = await run;
      const updates: Record<string, number> = {};
      fresh.forEach(({ hash }, index) => {
        const value = values[index];
        if (value !== undefined) {
          memory.set(hash, value);
          updates[`score:${hash}`] = value;
          scores[hash] = value;
        }
      });
      await chrome.storage.local.set(updates);
    } finally {
      fresh.forEach(({ hash }) => inflight.delete(hash));
    }
  }
  for (const { hash } of waiting) {
    const value = await inflight.get(hash)?.catch(() => undefined);
    if (value !== undefined) {
      scores[hash] = value;
    }
  }
  return { scores };
}

chrome.runtime.onMessage.addListener(
  (message: ScoreRequest | StatusRequest | InferRequest, _sender, sendResponse) => {
    if (message.type === "score") {
      score(message.items).then(sendResponse, (error: unknown) => {
        console.error(error);
        sendResponse(undefined);
      });
      return true;
    }
    if (message.type === "status") {
      const response: StatusResponse = { model: status, cachedScores: memory.size };
      sendResponse(response);
    }
    return false;
  },
);
