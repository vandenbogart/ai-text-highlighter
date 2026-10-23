import { adapters } from "./adapters";
import type { ScoreRequest, ScoreResponse } from "./messages";
import { DEFAULT_THRESHOLD, MODEL_ID, MODEL_REVISION } from "./model";
import { hashText, normalize } from "./text";

const MIN_CHARS = 40;
const BATCH_SIZE = 8;
const DEBOUNCE_MS = 250;
const RETRY_MS = 5000;
const SCORE_ATTR = "data-ai-text-score";

const adapter = adapters.find((candidate) => candidate.matches(location.hostname));
const seen = new WeakMap<HTMLElement, string>();
const scored = new Map<HTMLElement, number>();
let threshold = DEFAULT_THRESHOLD;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let rescan = false;

function clear(element: HTMLElement): void {
  element.style.removeProperty("background-color");
  element.removeAttribute(SCORE_ATTR);
}

function paint(element: HTMLElement, score: number): void {
  if (score < threshold) {
    clear(element);
    return;
  }
  const strength = threshold >= 1 ? 1 : (score - threshold) / (1 - threshold);
  const alpha = 0.12 + 0.38 * Math.min(1, Math.max(0, strength));
  element.style.setProperty("background-color", `rgba(255, 64, 64, ${alpha.toFixed(3)})`);
  element.setAttribute(SCORE_ATTR, String(score));
}

async function scoreBatch(
  batch: { element: HTMLElement; text: string; hash: string }[],
): Promise<boolean> {
  const request: ScoreRequest = {
    type: "score",
    items: batch.map(({ hash, text }) => ({ hash, text })),
  };
  const response: ScoreResponse | undefined = await chrome.runtime
    .sendMessage(request)
    .catch(() => undefined);
  let complete = true;
  for (const { element, text, hash } of batch) {
    const score = response?.scores[hash];
    if (score === undefined) {
      complete = false;
      if (seen.get(element) === text) {
        seen.delete(element);
      }
    } else if (
      element.isConnected &&
      seen.get(element) === text &&
      normalize(element.textContent ?? "") === text
    ) {
      scored.set(element, score);
      paint(element, score);
    }
  }
  return complete;
}

async function scan(): Promise<void> {
  if (!adapter) {
    return;
  }
  if (running) {
    rescan = true;
    return;
  }
  running = true;
  try {
    for (const element of scored.keys()) {
      if (!element.isConnected) {
        scored.delete(element);
      }
    }
    const fresh: { element: HTMLElement; text: string; hash: string }[] = [];
    for (const element of adapter.textElements(document)) {
      const text = normalize(element.textContent ?? "");
      if (seen.get(element) === text) {
        continue;
      }
      seen.set(element, text);
      scored.delete(element);
      clear(element);
      if (text.length < MIN_CHARS) {
        continue;
      }
      fresh.push({
        element,
        text,
        hash: await hashText(`${MODEL_ID}@${MODEL_REVISION}\n${text}`),
      });
    }
    let complete = true;
    for (let start = 0; start < fresh.length; start += BATCH_SIZE) {
      complete = (await scoreBatch(fresh.slice(start, start + BATCH_SIZE))) && complete;
    }
    if (!complete) {
      setTimeout(schedule, RETRY_MS);
    }
  } finally {
    running = false;
    if (rescan) {
      rescan = false;
      schedule();
    }
  }
}

function schedule(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void scan(), DEBOUNCE_MS);
}

function tooltip(): HTMLElement {
  const element = document.createElement("div");
  element.style.cssText =
    "position:fixed;z-index:2147483647;pointer-events:none;display:none;padding:4px 8px;border-radius:6px;background:#1f1f1f;color:#fff;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)";
  document.documentElement.append(element);
  return element;
}

if (adapter) {
  const tip = tooltip();
  document.addEventListener("mouseover", (event) => {
    const target = event.target instanceof Element ? event.target.closest(`[${SCORE_ATTR}]`) : null;
    if (!target) {
      tip.style.display = "none";
      return;
    }
    const score = Number(target.getAttribute(SCORE_ATTR));
    tip.textContent = `${Math.round(score * 100)}% AI-written (model score)`;
    tip.style.display = "block";
  });
  document.addEventListener("mousemove", (event) => {
    tip.style.left = `${event.clientX + 12}px`;
    tip.style.top = `${event.clientY + 16}px`;
  });

  chrome.storage.local.get("threshold").then(({ threshold: stored }) => {
    if (typeof stored === "number") {
      threshold = stored;
    }
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    void scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    const next = changes.threshold?.newValue;
    if (area === "local" && typeof next === "number") {
      threshold = next;
      for (const [element, score] of scored) {
        paint(element, score);
      }
    }
  });
}
