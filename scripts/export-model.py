import sys
from pathlib import Path


def export_fp32(source: Path, output: Path) -> None:
    import torch
    from transformers import AutoModelForSequenceClassification

    model = AutoModelForSequenceClassification.from_pretrained(
        source, attn_implementation="eager", dtype=torch.float32
    ).eval()
    input_ids = torch.tensor([[50281, 1000, 2000, 3000, 50282]], dtype=torch.long)
    attention_mask = torch.ones_like(input_ids)
    with torch.no_grad():
        torch.onnx.export(
            model,
            (input_ids, attention_mask),
            str(output),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch", 1: "sequence"},
                "attention_mask": {0: "batch", 1: "sequence"},
                "logits": {0: "batch"},
            },
            opset_version=17,
            dynamo=False,
        )


def export_fp16(fp32: Path, output: Path) -> None:
    import onnx
    from onnxruntime.transformers.onnx_model import OnnxModel

    model = OnnxModel(onnx.load(str(fp32)))
    model.convert_float_to_float16(keep_io_types=True)
    model.save_model_to_file(str(output), use_external_data_format=False)


step, source, output = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
output.parent.mkdir(parents=True, exist_ok=True)
partial = output.with_name(output.name + ".part")
{"fp32": export_fp32, "fp16": export_fp16}[step](source, partial)
partial.rename(output)
