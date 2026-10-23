import type { StatusRequest, StatusResponse } from "./messages";
import { DEFAULT_THRESHOLD } from "./model";

const slider = document.querySelector<HTMLInputElement>("#threshold");
const value = document.querySelector<HTMLOutputElement>("#value");
const status = document.querySelector<HTMLParagraphElement>("#status");

function show(threshold: number): void {
  if (slider && value) {
    slider.value = String(threshold);
    value.textContent = `${Math.round(threshold * 100)}%`;
  }
}

chrome.storage.local.get("threshold").then(({ threshold }) => {
  show(typeof threshold === "number" ? threshold : DEFAULT_THRESHOLD);
});

slider?.addEventListener("input", () => {
  const threshold = Number(slider.value);
  show(threshold);
  void chrome.storage.local.set({ threshold });
});

const request: StatusRequest = { type: "status" };
chrome.runtime.sendMessage(request).then((response: StatusResponse) => {
  if (status) {
    status.textContent = response.model
      ? `Model on ${response.model.backend} (${response.model.dtype}), loaded in ${(response.model.loadMs / 1000).toFixed(1)} s. ${response.cachedScores} scores cached.`
      : "Model loads when the first post is scored.";
  }
});
