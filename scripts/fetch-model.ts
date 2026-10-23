import { existsSync, mkdirSync } from "node:fs";
import { copyFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { MODEL_ID } from "../src/model";

const REVISION = "4bf4a146a66df346e5b54e4b5ebda3fee1a19a86";
const SOURCE_DIR = join("models", `${MODEL_ID.replace("/", "--")}-${REVISION}`);
const TARGET_DIR = join("dist", "models", MODEL_ID);

const FILES: { name: string; sha256?: string }[] = [
  { name: "config.json" },
  { name: "tokenizer.json" },
  { name: "tokenizer_config.json" },
  {
    name: "model.safetensors",
    sha256: "ccc7bc942ebfe8cc21a35d64b2124a7cff0702a0a9e71b1f9b8e0eba53b0ddd5",
  },
];

const PYTHON_PACKAGES = [
  "torch==2.14.1+cpu",
  "transformers==5.20.2",
  "safetensors==0.8.0",
  "onnx==1.23.2",
  "onnxscript==0.7.2",
  "onnxruntime==1.31.0",
];

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) {
    hasher.update(chunk);
  }
  return hasher.digest("hex");
}

async function download(name: string, expected: string | undefined): Promise<void> {
  const path = join(SOURCE_DIR, name);
  if (existsSync(path) && (!expected || (await sha256(path)) === expected)) {
    return;
  }
  const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${name}`;
  console.log(`Downloading ${name}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download of ${name} failed with HTTP ${response.status}`);
  }
  const partial = `${path}.part`;
  const writer = Bun.file(partial).writer();
  for await (const chunk of response.body) {
    writer.write(chunk);
    await writer.flush();
  }
  await writer.end();
  await rename(partial, path);
  if (expected && (await sha256(path)) !== expected) {
    throw new Error(`Checksum mismatch for ${name}`);
  }
}

mkdirSync(SOURCE_DIR, { recursive: true });
mkdirSync(TARGET_DIR, { recursive: true });

for (const file of FILES) {
  await download(file.name, file.sha256);
}

for (const name of ["config.json", "tokenizer.json", "tokenizer_config.json"]) {
  await copyFile(join(SOURCE_DIR, name), join(TARGET_DIR, name));
}

const FP32 = join(SOURCE_DIR, "model.onnx");
const STEPS: { step: string; input: string; output: string }[] = [
  { step: "fp32", input: SOURCE_DIR, output: FP32 },
  { step: "fp16", input: FP32, output: join(TARGET_DIR, "onnx", "model_fp16.onnx") },
];

for (const { step, input, output } of STEPS) {
  if (existsSync(output)) {
    continue;
  }
  console.log(`Exporting ${output}`);
  const exporter = Bun.spawnSync(
    [
      "uv",
      "run",
      "--no-project",
      "--python",
      "3.11",
      "--index",
      "https://download.pytorch.org/whl/cpu",
      "--index-strategy",
      "unsafe-best-match",
      ...PYTHON_PACKAGES.flatMap((pkg) => ["--with", pkg]),
      "python",
      join("scripts", "export-model.py"),
      step,
      input,
      output,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (exporter.exitCode !== 0) {
    process.exit(exporter.exitCode ?? 1);
  }
}

for (const { step, output } of STEPS.slice(1)) {
  console.log(`${step} ${output} ${(Bun.file(output).size / 1048576).toFixed(1)} MB`);
}
