import { LABEL_GUIDE } from '#lib/categories.ts';
import type { AnalysisResult, Detection } from '#lib/types.ts';
import type { AnalyzerProgress, PartAnalyzer } from './analyzer';
import { hashFile, type Photo } from './image';
import { assessQuality } from './quality';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEMO_DETECTIONS: Detection[] = [
	{
		id: 'gpu-1',
		category: 'gpu',
		confidence: 0.9,
		boundingBox: { x: 0.12, y: 0.47, width: 0.72, height: 0.23 },
		outline: [
			{ x: 0.13, y: 0.49 }, { x: 0.79, y: 0.49 }, { x: 0.84, y: 0.53 }, { x: 0.83, y: 0.66 },
			{ x: 0.76, y: 0.69 }, { x: 0.18, y: 0.69 }, { x: 0.12, y: 0.64 }, { x: 0.12, y: 0.53 }
		],
		visibleText: [],
		observations: ['데모 데이터: 실제 사진을 분석한 결과가 아닙니다.'],
		manufacturerCandidates: [],
		productCandidates: [],
		needsConfirmation: true,
		requestedPhoto: LABEL_GUIDE.gpu
	},
	{
		id: 'memory-1',
		category: 'memory',
		confidence: 0.82,
		boundingBox: { x: 0.63, y: 0.14, width: 0.15, height: 0.32 },
		outline: [
			{ x: 0.65, y: 0.15 }, { x: 0.69, y: 0.14 }, { x: 0.71, y: 0.16 }, { x: 0.73, y: 0.15 }, { x: 0.76, y: 0.17 },
			{ x: 0.77, y: 0.43 }, { x: 0.74, y: 0.46 }, { x: 0.66, y: 0.45 }, { x: 0.64, y: 0.41 }
		],
		visibleText: [],
		observations: ['데모 데이터: 실제 사진을 분석한 결과가 아닙니다.'],
		manufacturerCandidates: [],
		productCandidates: [],
		needsConfirmation: true,
		requestedPhoto: LABEL_GUIDE.memory
	},
	{
		id: 'cpu_cooler-1',
		category: 'cpu_cooler',
		confidence: 0.78,
		boundingBox: { x: 0.32, y: 0.13, width: 0.28, height: 0.3 },
		outline: [
			{ x: 0.35, y: 0.14 }, { x: 0.54, y: 0.14 }, { x: 0.59, y: 0.2 }, { x: 0.59, y: 0.38 },
			{ x: 0.54, y: 0.43 }, { x: 0.37, y: 0.42 }, { x: 0.32, y: 0.36 }, { x: 0.32, y: 0.2 }
		],
		visibleText: [],
		observations: ['데모 데이터: 실제 사진을 분석한 결과가 아닙니다.'],
		manufacturerCandidates: [],
		productCandidates: [],
		needsConfirmation: true,
		requestedPhoto: LABEL_GUIDE.cpu_cooler
	}
];

/** 학습된 모델이 배포되기 전, 화면 흐름을 확인하기 위한 분석기. 품질 검사만 실제로 수행한다. */
export class DemoAnalyzer implements PartAnalyzer {
	readonly kind = 'demo' as const;
	readonly name = '데모 분석기';

	async prepare() {}

	async analyze(photo: Photo, onProgress?: (progress: AnalyzerProgress) => void): Promise<AnalysisResult> {
		const started = performance.now();
		const imageQuality = assessQuality(photo.bitmap);
		onProgress?.({ stage: 'inference' });
		await wait(1400);
		onProgress?.({ stage: 'postprocess' });
		await wait(300);
		return {
			imageId: await hashFile(photo.file),
			imageQuality,
			detections: structuredClone(DEMO_DETECTIONS),
			warnings: [
				'학습된 모델이 아직 배포되지 않아 고정된 데모 결과를 보여줍니다. 사진 내용과 무관합니다.',
				'사진만으로 정확한 모델과 완전 체결 여부는 확정할 수 없습니다.'
			],
			engine: {
				kind: 'demo',
				name: this.name,
				timings: { inferenceMs: 0, totalMs: Math.round(performance.now() - started) }
			}
		};
	}

	dispose() {}
}
