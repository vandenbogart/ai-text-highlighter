export type Backend = "webgpu" | "wasm";

export interface ScoreRequest {
  type: "score";
  items: { hash: string; text: string }[];
}

export interface ScoreResponse {
  scores: Record<string, number>;
}

export interface InferRequest {
  target: "offscreen";
  type: "infer";
  texts: string[];
}

export type InferResponse =
  | { ok: true; scores: number[]; status: ModelStatus }
  | { ok: false; error: string };

export interface ModelStatus {
  backend: Backend;
  dtype: string;
  loadMs: number;
}

export interface StatusRequest {
  type: "status";
}

export interface StatusResponse {
  model: ModelStatus | null;
  cachedScores: number;
}
