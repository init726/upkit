import { CATEGORIES, type ComponentCategory } from '#lib/types.ts';

/**
 * 학습 파이프라인(training/)과 웹앱 사이의 계약.
 * training에서 ONNX를 내보낼 때 같은 폴더에 model.json으로 함께 저장한다.
 */
export interface ModelManifest {
	name: string;
	version: string;
	/** 현재 디코더가 지원하는 출력 형식 */
	architecture: 'detr-seg';
	/** manifest 기준 상대 경로 */
	file: string;
	input: {
		/** 정사각형 입력 한 변 (비율 유지 없이 늘려서 넣는다) */
		size: number;
		/** 0~1로 스케일한 RGB에 적용할 정규화 값 */
		mean: [number, number, number];
		std: [number, number, number];
	};
	/** 로짓 인덱스 → 카테고리. 사용하지 않는 인덱스(배경, 상위 클래스 등)는 null */
	classes: (ComponentCategory | null)[];
	/** ONNX 출력 이름. 없으면 텐서 모양으로 추정한다. */
	outputs: { boxes?: string; logits?: string; masks?: string };
	thresholds: {
		/** 이 점수 미만은 버린다 */
		minScore: number;
		/** 이 점수 미만은 카테고리를 확정하지 않고 unknown으로 보여준다 */
		unknownBelow: number;
		/** 이 점수 미만은 사용자 확인이 필요하다고 표시한다 */
		confirmBelow: number;
		/** 마스크 로짓 임계값 (기본 0 = 확률 0.5) */
		maskLogit?: number;
	};
	maxDetections: number;
}

export const MODEL_DIR = '/models/upkit-seg/';

function isTriple(value: unknown): value is [number, number, number] {
	return Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number');
}

function validate(raw: unknown): ModelManifest {
	const m = raw as ModelManifest;
	const problems: string[] = [];
	if (m?.architecture !== 'detr-seg') problems.push('architecture는 "detr-seg"여야 합니다.');
	if (typeof m?.file !== 'string') problems.push('file이 없습니다.');
	if (!(m?.input?.size > 0)) problems.push('input.size가 없습니다.');
	if (!isTriple(m?.input?.mean) || !isTriple(m?.input?.std)) problems.push('input.mean/std는 숫자 3개여야 합니다.');
	if (!Array.isArray(m?.classes) || !m.classes.some(Boolean)) problems.push('classes가 비어 있습니다.');
	else if (m.classes.some((c) => c !== null && !CATEGORIES.includes(c)))
		problems.push(`classes에는 ${CATEGORIES.join(', ')} 또는 null만 쓸 수 있습니다.`);
	if (typeof m?.thresholds?.minScore !== 'number') problems.push('thresholds.minScore가 없습니다.');
	if (problems.length) throw new Error(`model.json 형식 오류: ${problems.join(' ')}`);
	return {
		...m,
		outputs: m.outputs ?? {},
		maxDetections: m.maxDetections ?? 20,
		thresholds: {
			...m.thresholds,
			unknownBelow: m.thresholds.unknownBelow ?? m.thresholds.minScore,
			confirmBelow: m.thresholds.confirmBelow ?? 0.6,
			maskLogit: m.thresholds.maskLogit ?? 0
		}
	};
}

/** 학습된 모델이 배포되어 있으면 manifest를, 없으면 null을 반환한다. */
export async function loadManifest(fetchFn: typeof fetch = fetch): Promise<ModelManifest | null> {
	let response: Response;
	try {
		response = await fetchFn(`${MODEL_DIR}model.json`, { cache: 'no-cache' });
	} catch {
		return null;
	}
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`model.json을 불러오지 못했습니다 (${response.status}).`);
	return validate(await response.json());
}

export function modelUrl(manifest: ModelManifest) {
	return new URL(manifest.file, new URL(MODEL_DIR, location.origin)).href;
}
