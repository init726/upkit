import type { AnalysisResult } from '#lib/types.ts';
import type { AnalyzerProgress, PartAnalyzer } from '../analyzer';
import { hashFile, type Photo } from '../image';
import { QUALITY_MESSAGES, assessQuality } from '../quality';
import { applyRules } from '../rules';
import { modelUrl, type ModelManifest } from './manifest';
import type { RawDetection } from './postprocess';
import type { WorkerRequest, WorkerResponse } from './worker';

type Pending = {
	resolve: (value: { detections: RawDetection[]; inferenceMs: number }) => void;
	reject: (error: Error) => void;
};

/** 학습된 분할 모델을 브라우저(Web Worker)에서 실행한다. 사진은 기기 밖으로 나가지 않는다. */
export class OnnxAnalyzer implements PartAnalyzer {
	readonly kind = 'on-device' as const;
	readonly name: string;
	backend: 'webgpu' | 'wasm' | null = null;
	loadMs = 0;

	private worker: Worker | null = null;
	private ready: Promise<void> | null = null;
	private pending = new Map<number, Pending>();
	private nextId = 1;
	private listener: ((progress: AnalyzerProgress) => void) | undefined;

	constructor(private manifest: ModelManifest) {
		this.name = `${manifest.name} v${manifest.version}`;
	}

	prepare(onProgress?: (progress: AnalyzerProgress) => void): Promise<void> {
		if (onProgress) this.listener = onProgress;
		if (this.ready) return this.ready;

		this.ready = new Promise<void>((resolve, reject) => {
			const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
			this.worker = worker;
			worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
				const message = event.data;
				switch (message.type) {
					case 'progress':
						this.listener?.(message.stage === 'download' ? { stage: 'download', ratio: message.ratio } : { stage: 'compile' });
						break;
					case 'ready':
						this.backend = message.backend;
						this.loadMs = message.loadMs;
						resolve();
						break;
					case 'result':
						this.pending.get(message.id)?.resolve(message);
						this.pending.delete(message.id);
						break;
					case 'error': {
						const error = new Error(message.message);
						if (message.id === undefined) {
							reject(error);
							this.ready = null;
						} else {
							this.pending.get(message.id)?.reject(error);
							this.pending.delete(message.id);
						}
					}
				}
			};
			worker.onerror = (event) => {
				reject(new Error(event.message || '분석 워커를 시작하지 못했습니다.'));
				this.ready = null;
			};
			const request: WorkerRequest = { type: 'init', manifest: this.manifest, modelUrl: modelUrl(this.manifest) };
			worker.postMessage(request);
		});
		return this.ready;
	}

	async analyze(photo: Photo, onProgress?: (progress: AnalyzerProgress) => void): Promise<AnalysisResult> {
		const started = performance.now();
		this.listener = onProgress;
		await this.prepare();

		const imageQuality = assessQuality(photo.bitmap);
		onProgress?.({ stage: 'inference' });

		const id = this.nextId++;
		// 원본 비트맵은 화면에서 계속 쓰므로 복사본을 워커로 넘긴다.
		const bitmap = await createImageBitmap(photo.bitmap);
		const output = await new Promise<{ detections: RawDetection[]; inferenceMs: number }>((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			const request: WorkerRequest = { type: 'run', id, bitmap };
			this.worker!.postMessage(request, [bitmap]);
		});

		onProgress?.({ stage: 'postprocess' });
		const detections = applyRules(output.detections, this.manifest.thresholds, this.manifest.maxDetections);

		const warnings: string[] = [];
		if (!detections.length) {
			imageQuality.usable = false;
			imageQuality.issues.push('no_parts');
			warnings.push(QUALITY_MESSAGES.no_parts);
		}
		warnings.push('사진만으로 정확한 모델과 완전 체결 여부는 확정할 수 없습니다.');

		return {
			imageId: await hashFile(photo.file),
			imageQuality,
			detections,
			warnings,
			engine: {
				kind: 'on-device',
				name: this.name,
				modelVersion: this.manifest.version,
				backend: this.backend ?? undefined,
				timings: {
					loadMs: this.loadMs,
					inferenceMs: output.inferenceMs,
					totalMs: Math.round(performance.now() - started)
				}
			}
		};
	}

	dispose() {
		this.worker?.terminate();
		this.worker = null;
		this.ready = null;
		for (const pending of this.pending.values()) pending.reject(new Error('분석기가 종료되었습니다.'));
		this.pending.clear();
	}
}
