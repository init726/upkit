import type { AnalysisResult } from '#lib/types.ts';
import type { Photo } from './image';
import { loadManifest } from './onnx/manifest';

export type AnalyzerProgress =
	| { stage: 'download'; ratio?: number }
	| { stage: 'compile' }
	| { stage: 'inference' }
	| { stage: 'postprocess' };

export interface PartAnalyzer {
	readonly kind: 'demo' | 'on-device';
	readonly name: string;
	/** 모델을 미리 내려받고 준비한다. 여러 번 불러도 한 번만 실행된다. */
	prepare(onProgress?: (progress: AnalyzerProgress) => void): Promise<void>;
	analyze(photo: Photo, onProgress?: (progress: AnalyzerProgress) => void): Promise<AnalysisResult>;
	dispose(): void;
}

/**
 * 배포된 학습 모델(static/models/upkit-seg/model.json)이 있으면 기기 내 분석기를,
 * 없으면 데모 분석기를 사용한다.
 */
export async function createAnalyzer(): Promise<PartAnalyzer> {
	const manifest = await loadManifest();
	if (manifest) {
		const { OnnxAnalyzer } = await import('./onnx/client');
		return new OnnxAnalyzer(manifest);
	}
	const { DemoAnalyzer } = await import('./demo');
	return new DemoAnalyzer();
}
