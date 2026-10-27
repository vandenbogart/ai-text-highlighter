import { cp, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { MODEL_ID, MODEL_REVISION } from "../src/model";

const { version } = (await Bun.file("dist/manifest.json").json()) as { version: string };
const archive = resolve("releases", `ai-text-highlighter-${version}.zip`);
const model = `models/${MODEL_ID}`;
const files = [
  "manifest.json",
  "background.js",
  "content.js",
  "offscreen.html",
  "offscreen.js",
  "popup.html",
  "popup.js",
  "ort/ort-wasm-simd-threaded.asyncify.mjs",
  "ort/ort-wasm-simd-threaded.asyncify.wasm",
  `${model}/config.json`,
  `${model}/tokenizer.json`,
  `${model}/tokenizer_config.json`,
  `${model}/onnx/model_fp16.onnx`,
];

await mkdir(".scratch", { recursive: true });
const staging = await mkdtemp(".scratch/package-");
const root = join(staging, "ai-text-highlighter");

try {
  for (const file of files) {
    const target = join(root, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(join("dist", file), target);
  }
  await cp("LICENSE", join(root, "LICENSE"));
  await cp("README.md", join(root, "README.md"));
  const licenses = join(root, "licenses");
  await mkdir(licenses);
  for (const dependency of ["transformers", "tokenizers", "jinja"]) {
    await cp(
      `node_modules/@huggingface/${dependency}/LICENSE`,
      join(licenses, `${dependency}.LICENSE`),
    );
  }
  const ortRevision = (await Bun.file("node_modules/onnxruntime-web/__commit.txt").text()).trim();
  const ortSource = `https://raw.githubusercontent.com/microsoft/onnxruntime/${ortRevision}`;
  const modelSource = `https://huggingface.co/${MODEL_ID}/raw/${MODEL_REVISION}`;
  for (const [file, url] of [
    ["onnxruntime.LICENSE", `${ortSource}/LICENSE`],
    ["onnxruntime.ThirdPartyNotices.txt", `${ortSource}/ThirdPartyNotices.txt`],
    ["model-card.md", `${modelSource}/README.md`],
  ] as const) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download of ${file} failed with HTTP ${response.status}`);
    }
    await Bun.write(join(licenses, file), await response.arrayBuffer());
  }
  await Bun.write(
    join(licenses, "SOURCES.txt"),
    `Model: ${modelSource}\nWeights converted to fp16 ONNX; configuration and tokenizer copied unchanged.\nONNX Runtime: ${ortSource}\nHugging Face library versions: see bun.lock in the source repository.\n`,
  );
  await mkdir(dirname(archive), { recursive: true });
  const partial = join(staging, "release.zip");
  const result = Bun.spawnSync(
    ["uv", "run", "--no-project", "--python", "3.11", "python", "-m", "zipfile", "-c", resolve(partial), "ai-text-highlighter"],
    { cwd: staging, stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode !== 0) {
    throw new Error(`Packaging failed with exit code ${result.exitCode}`);
  }
  await rename(partial, archive);
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(archive).stream()) {
    hasher.update(chunk);
  }
  await Bun.write(`${archive}.sha256`, `${hasher.digest("hex")}  ${basename(archive)}\n`);
  console.log(`Packaged ${archive} (${(Bun.file(archive).size / 1_000_000).toFixed(1)} MB)`);
  console.log(`Checksum ${archive}.sha256`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
