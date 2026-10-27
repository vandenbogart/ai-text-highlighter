# ai-text-highlighter

Experimental Chrome extension that highlights post text on X using a browser-local AI-writing detector.

Posts above your threshold get a red tint that grows with the model score. Hover a tinted post to see its score. This is not proof of authorship: the detector can misclassify both human and AI writing.

## Install in Chrome

This extension is loaded manually in desktop Chrome, not installed from the Chrome Web Store.

1. Download a packaged ZIP from [Releases](https://github.com/vandenbogart/ai-text-highlighter/releases), when available, and unzip it. Otherwise, build from source below.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted `ai-text-highlighter` folder containing `manifest.json`, or `dist/` for a source build.
4. Open or refresh your X feed. The first highlights can take tens of seconds while the model loads and scores posts.

Keep the extracted folder in place while the extension is installed. To update, replace its files, click **Reload** on the extension, and refresh X. To uninstall, click **Remove** on the extension.

## Build from source

Requires [Bun](https://bun.sh) 1.4.4 or newer and [uv](https://docs.astral.sh/uv/). Allow several GB of disk space and at least 3 GB of available memory for the model conversion.

```sh
git clone https://github.com/vandenbogart/ai-text-highlighter.git
cd ai-text-highlighter
bun install --frozen-lockfile
bun run fetch-model
bun run build
```

`fetch-model` downloads a pinned model revision, verifies the weight checksum and converts it to fp16 ONNX in `dist/models/`. Bun dependencies, Python packages and model downloads require internet access during setup. Rebuilding keeps the downloaded model.

## Use and limitations

- Open **AI Text Highlighter** from Chrome's Extensions menu to change the threshold, which defaults to 50%. Changes repaint scored posts immediately.
- A 0% threshold highlights every scored post; higher thresholds highlight fewer posts. Untinted text is not necessarily human-written.
- Only post text on `x.com` and `twitter.com` is scored, not images, video, profiles or the rest of the page. Posts shorter than 40 characters are skipped; longer posts are truncated to 512 tokens, or word fragments.
- The detector is intended for English. Non-English, short and heavily edited text is less reliable. Scores are not calibrated probabilities, and false positives and false negatives can be substantial. Do not treat highlights as evidence of authorship.
- The model is about 286 MB, plus about 27 MB of runtime files. It tries WebGPU and falls back to CPU execution through WebAssembly. Scoring uncached posts can take around a second each on a slow CPU.
- X can change its page structure and break post detection. Report problems through [Issues](https://github.com/vandenbogart/ai-text-highlighter/issues); include your Chrome version and extension error, but no private posts or account information.

## Privacy

Post text stays in your browser. The extension has no analytics, account or inference server, and loads its model and runtime from the installed extension files. It stores text hashes, scores and your threshold locally, not the original post text. Matching text can reuse cached scores across visits and tabs.

## Development and packaging

```sh
bun run ci
bun run package
```

`ci` runs type checking, linting, the tracked-file policy check and the build. `bun install` sets up the pre-push hook to run it before every push.

`package` fetches the model, runs `ci`, downloads pinned third-party license notices and writes a loadable ZIP and SHA-256 checksum to `releases/`. It includes only the required extension files, model, README and license notices. Version numbers come from `static/manifest.json`. Upload the ZIP and checksum together when publishing a release. Generated files and model weights are not committed.

## License

The extension's source code is [MIT licensed](LICENSE). [Transformers.js](https://github.com/huggingface/transformers.js) and Hugging Face Tokenizers use Apache-2.0; [ONNX Runtime](https://github.com/microsoft/onnxruntime) and Hugging Face Jinja use MIT. Dependencies retain their own licenses.

The pinned [tabularisai/ai-text-detection model card](https://huggingface.co/tabularisai/ai-text-detection/blob/4bf4a146a66df346e5b54e4b5ebda3fee1a19a86/README.md) declares MIT licensing. Packaged releases include that card, the model conversion notice, library licenses and ONNX Runtime's third-party notices in `licenses/`.
