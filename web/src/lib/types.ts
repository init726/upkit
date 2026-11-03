export const CATEGORIES = [
	'motherboard',
	'gpu',
	'memory',
	'storage',
	'cpu_cooler',
	'power_supply',
	'case_fan',
	'unknown'
] as const;

export type ComponentCategory = (typeof CATEGORIES)[number];

/** 원본 이미지 너비·높이 기준 0~1 정규화 좌표 */
export interface Point {
	x: number;
	y: number;
}

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

export type QualityIssue = 'dark' | 'overexposed' | 'blurry' | 'low_resolution' | 'no_parts';

export interface ImageQuality {
	usable: boolean;
	issues: QualityIssue[];
	metrics?: {
		width: number;
		height: number;
		/** 0~255 평균 밝기 */
		brightness: number;
		/** 라플라시안 분산 (클수록 선명) */
		sharpness: number;
	};
}

export interface ProductCandidate {
	productId: string;
	score: number;
	evidence: string[];
}

export interface Detection {
	id: string;
	category: ComponentCategory;
	/** 모델이 출력한 점수 (0~1). 보정(calibration) 전 값이므로 확률로 해석하지 않는다. */
	confidence: number;
	boundingBox: Box;
	outline?: Point[];
	visibleText: string[];
	observations: string[];
	manufacturerCandidates: string[];
	productCandidates: ProductCandidate[];
	needsConfirmation: boolean;
	requestedPhoto?: string;
}

export interface EngineInfo {
	kind: 'demo' | 'on-device';
	name: string;
	modelVersion?: string;
	backend?: 'webgpu' | 'wasm';
	timings: { loadMs?: number; inferenceMs: number; totalMs: number };
}

export interface AnalysisResult {
	imageId: string;
	imageQuality: ImageQuality;
	detections: Detection[];
	warnings: string[];
	engine: EngineInfo;
}

/** 라벨(스티커·각인) 사진에서 읽어낸 정보. 추측이 아니라 보이는 문자만 담는다. */
export interface LabelReading {
	visibleText: string[];
	manufacturer: string | null;
	model: string | null;
	partNumber: string | null;
	category: ComponentCategory | null;
	legibility: 'clear' | 'partial' | 'unreadable';
	notes: string[];
	provider: string;
	demo: boolean;
}

export interface ApiError {
	error: { code: string; message: string };
}
