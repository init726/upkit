/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/webgpu';
import type { ModelManifest } from './manifest';
import { decodeDetr, pickOutputs, type RawDetection, type TensorLike } from './postprocess';

export type WorkerRequest =
	| { type: 'init'; manifest: ModelManifest; modelUrl: string }
	| { type: 'run'; id: number; bitmap: ImageBitmap };

export type WorkerResponse =
	| { type: 'progress'; stage: 'download' | 'compile'; ratio?: number }
	| { type: 'ready'; backend: 'webgpu' | 'wasm'; loadMs: number }
	| { type: 'result'; id: number; detections: RawDetection[]; inferenceMs: number }
	| { type: 'error'; id?: number; message: string };

declare const self: DedicatedWorkerGlobalScope;

// WebGPU 런타임 wasm(약 28MB)은 정적 호스팅 파일 크기 제한을 넘을 수 있어 같은 버전을 CDN에서 받는다.
// 사용자 사진은 이 경로로 전송되지 않는다.
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

let session: ort.InferenceSession | null = null;
let manifest: ModelManifest | null = null;

const post = (message: WorkerResponse) => self.postMessage(message);

const CACHE_NAME = 'upkit-models';

/** 모델을 내려받는다. 한 번 받은 버전은 Cache Storage에 보관해 다음 방문부터 즉시 로드한다. */
async function fetchModel(url: string, version: string): Promise<Uint8Array> {
	const key = `${url}?v=${encodeURIComponent(version)}`;
	const cache = 'caches' in self ? await caches.open(CACHE_NAME).catch(() => null) : null;
	const cached = await cache?.match(key);
	if (cached) return new Uint8Array(await cached.arrayBuffer());

	const response = await fetch(url);
	if (!response.ok || !response.body) throw new Error(`모델 파일을 내려받지 못했습니다 (${response.status}).`);
	const total = Number(response.headers.get('content-length')) || 0;
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.length;
		post({ type: 'progress', stage: 'download', ratio: total ? received / total : undefined });
	}
	const bytes = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) bytes.set(chunk, offset), (offset += chunk.length);

	if (cache) {
		// 예전 버전은 지우고 현재 버전만 남긴다.
		for (const request of await cache.keys()) if (request.url.startsWith(url)) await cache.delete(request);
		await cache.put(key, new Response(bytes.slice())).catch(() => undefined);
	}
	return bytes;
}

async function hasWebGpu(): Promise<boolean> {
	const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
	if (!gpu) return false;
	try {
		return Boolean(await gpu.requestAdapter());
	} catch {
		return false;
	}
}

async function init(m: ModelManifest, url: string) {
	const started = performance.now();
	manifest = m;
	const bytes = await fetchModel(url, m.version);
	post({ type: 'progress', stage: 'compile' });

	const options = { graphOptimizationLevel: 'all' as const };
	let backend: 'webgpu' | 'wasm' = 'wasm';
	if (await hasWebGpu()) {
		try {
			session = await ort.InferenceSession.create(bytes, { ...options, executionProviders: ['webgpu'] });
			backend = 'webgpu';
		} catch (error) {
			console.warn('[upkit] WebGPU 세션 생성 실패, WASM으로 대체합니다.', error);
		}
	}
	session ??= await ort.InferenceSession.create(bytes, { ...options, executionProviders: ['wasm'] });
	post({ type: 'ready', backend, loadMs: Math.round(performance.now() - started) });
}

/** RGB 0~1 → (x - mean) / std, NCHW. 비율 유지 없이 정사각형으로 늘린다(학습 시 전처리와 동일해야 한다). */
function preprocess(bitmap: ImageBitmap, m: ModelManifest): ort.Tensor {
	const size = m.input.size;
	const canvas = new OffscreenCanvas(size, size);
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('OffscreenCanvas를 사용할 수 없습니다.');
	ctx.drawImage(bitmap, 0, 0, size, size);
	bitmap.close();
	const { data } = ctx.getImageData(0, 0, size, size);
	const plane = size * size;
	const input = new Float32Array(3 * plane);
	const [mr, mg, mb] = m.input.mean;
	const [sr, sg, sb] = m.input.std;
	for (let i = 0; i < plane; i++) {
		input[i] = (data[i * 4] / 255 - mr) / sr;
		input[plane + i] = (data[i * 4 + 1] / 255 - mg) / sg;
		input[2 * plane + i] = (data[i * 4 + 2] / 255 - mb) / sb;
	}
	return new ort.Tensor('float32', input, [1, 3, size, size]);
}

async function run(id: number, bitmap: ImageBitmap) {
	if (!session || !manifest) throw new Error('모델이 아직 준비되지 않았습니다.');
	const started = performance.now();
	const input = preprocess(bitmap, manifest);
	const results = await session.run({ [session.inputNames[0]]: input });

	const tensors: Record<string, TensorLike> = {};
	for (const [name, tensor] of Object.entries(results)) {
		// WebGPU 출력은 GPU 버퍼일 수 있으므로 CPU로 읽어온다.
		const data = tensor.location === 'cpu' ? tensor.data : await tensor.getData();
		tensors[name] = { dims: tensor.dims, data: data as ArrayLike<number> };
	}
	const detections = decodeDetr(pickOutputs(tensors, manifest.outputs), manifest);
	input.dispose();
	for (const tensor of Object.values(results)) tensor.dispose();
	post({ type: 'result', id, detections, inferenceMs: Math.round(performance.now() - started) });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;
	try {
		if (message.type === 'init') await init(message.manifest, message.modelUrl);
		else if (message.type === 'run') await run(message.id, message.bitmap);
	} catch (error) {
		post({
			type: 'error',
			id: message.type === 'run' ? message.id : undefined,
			message: error instanceof Error ? error.message : String(error)
		});
	}
};
