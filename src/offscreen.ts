import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Tensor,
} from "@huggingface/transformers";
import type { Backend, InferRequest, InferResponse, ModelStatus } from "./messages";
import { MAX_TOKENS, MODEL_ID } from "./model";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL("models/");
env.useBrowserCache = false;
env.useWasmCache = false;

const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.wasmPaths = {
    mjs: chrome.runtime.getURL("ort/ort-wasm-simd-threaded.asyncify.mjs"),
    wasm: chrome.runtime.getURL("ort/ort-wasm-simd-threaded.asyncify.wasm"),
  };
  wasm.numThreads = 1;
}

interface Loaded {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
  status: ModelStatus;
}

async function webgpuAvailable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) {
    return false;
  }
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

async function load(): Promise<Loaded> {
  const started = performance.now();
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  const backends: Backend[] = (await webgpuAvailable()) ? ["webgpu", "wasm"] : ["wasm"];
  let lastError: unknown;
  for (const backend of backends) {
    try {
      const model = await AutoModelForSequenceClassification.from_pretrained(MODEL_ID, {
        device: backend,
        dtype: "fp16",
      });
      return {
        tokenizer,
        model,
        status: { backend, dtype: "fp16", loadMs: Math.round(performance.now() - started) },
      };
    } catch (error) {
      console.warn(`Model load on ${backend} failed`, error);
      lastError = error;
    }
  }
  throw lastError;
}

let loading: Promise<Loaded> | null = null;

async function infer(texts: string[]): Promise<{ scores: number[]; status: ModelStatus }> {
  loading ??= load();
  const { tokenizer, model, status } = await loading;
  const inputs = tokenizer(texts, { padding: true, truncation: true, max_length: MAX_TOKENS });
  const { logits } = (await model(inputs)) as { logits: Tensor };
  const values = logits.data as Float32Array;
  const scores = texts.map((_, row) => {
    const human = values[row * 2] ?? 0;
    const ai = values[row * 2 + 1] ?? 0;
    return 1 / (1 + Math.exp(human - ai));
  });
  return { scores, status };
}

chrome.runtime.onMessage.addListener((message: InferRequest, _sender, sendResponse) => {
  if (message.target !== "offscreen" || message.type !== "infer") {
    return false;
  }
  infer(message.texts).then(
    ({ scores, status }) => sendResponse({ ok: true, scores, status } satisfies InferResponse),
    (error: unknown) => sendResponse({ ok: false, error: String(error) } satisfies InferResponse),
  );
  return true;
});
