# ai-text-highlighter

Chrome extension that highlights likely AI-written text on web pages, scored locally in the browser.

Post text on the x.com home feed gets a soft red tint that grows with the model's AI probability. Posts below the threshold (default 50%, set in the popup) are left alone. Hover a tinted post to see its score. Text never leaves the browser: the model runs in an offscreen document on WebGPU, falling back to WASM, and scores are cached by text hash.

Scores come from [tabularisai/ai-text-detection](https://huggingface.co/tabularisai/ai-text-detection) and are the model's own estimate, not a calibrated probability or proof of authorship. Short or non-English posts and heavily edited text are less reliable, and only the first 512 tokens are scored.

## Install

Requires Bun and uv.

```sh
bun install
bun run fetch-model
bun run build
```

`fetch-model` downloads the model once, converts it to fp16 ONNX and writes it into `dist/models/`. Rebuilding keeps it.

Open `chrome://extensions`, turn on Developer mode, choose Load unpacked and select `dist/`.

## Development

```sh
bun run ci
```

`bun install` points git at `.githooks`, so `bun run ci` runs before every push.
