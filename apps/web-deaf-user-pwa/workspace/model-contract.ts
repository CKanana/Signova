import {
  loadOnDeviceRecognizer,
  loadModelMetadata,
  recogniseOnDevice,
} from "../src/model/recogniser";

const out = document.getElementById("out")!;

async function main() {
  const model = await loadOnDeviceRecognizer();
  if (!model) {
    out.textContent = JSON.stringify({ ok: false, error: "model failed to load" }, null, 2);
    return;
  }
  const inputs = model.getInputDetails();
  const outputs = model.getOutputDetails();
  const metadata = await loadModelMetadata();
  const zeros = new Float32Array(60 * 126);
  let inference: unknown;
  try {
    const result = await recogniseOnDevice(zeros, metadata, false);
    inference = result
      ? { timingMs: result.timingMs, top1: result.results[0] }
      : { skipped: true };
  } catch (err) {
    inference = { error: (err as Error).message };
  }
  out.textContent = JSON.stringify(
    {
      ok: true,
      inputs: inputs.map((t) => ({ name: t.name, shape: Array.from(t.shape as number[]), dtype: t.dtype })),
      outputs: outputs.map((t) => ({ name: t.name, shape: Array.from(t.shape as number[]), dtype: t.dtype })),
      metadata: {
        numClasses: metadata.numClasses,
        labelCount: metadata.labelCount,
        labelMapAuthoritative: metadata.labelMapAuthoritative,
        realLabelCount: metadata.realLabelCount,
        firstLabels: metadata.labels?.slice(0, 5),
        lastLabel: metadata.labels?.[metadata.labelCount - 1],
      },
      inference,
    },
    null,
    2,
  );
}

main().catch((err) => {
  out.textContent = JSON.stringify({ ok: false, error: (err as Error).message }, null, 2);
});
