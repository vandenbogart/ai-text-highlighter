import { cp, mkdir } from "node:fs/promises";

const OUT = "dist";
const ORT = "node_modules/onnxruntime-web/dist";

async function bundle(entrypoints: string[], format: "esm" | "iife"): Promise<void> {
  const result = await Bun.build({
    entrypoints,
    outdir: OUT,
    target: "browser",
    format,
    minify: true,
  });
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}

await mkdir(`${OUT}/ort`, { recursive: true });
await bundle(["src/content.ts"], "iife");
await bundle(["src/background.ts", "src/offscreen.ts", "src/popup.ts"], "esm");
await cp("static", OUT, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"]) {
  await cp(`${ORT}/${file}`, `${OUT}/ort/${file}`);
}
