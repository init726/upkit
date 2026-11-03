import type { Box, ComponentCategory, Point } from '#lib/types.ts';
import { maskToPolygon } from './contour';
import type { ModelManifest } from './manifest';

/** 모델 출력에서 바로 디코딩한, 규칙 적용 전 탐지 */
export interface RawDetection {
	category: ComponentCategory;
	score: number;
	box: Box;
	outline: Point[] | null;
}

export interface TensorLike {
	dims: readonly number[];
	data: ArrayLike<number>;
}

export interface DetrOutputs {
	boxes: TensorLike; // [1, Q, 4] cx, cy, w, h (0~1)
	logits: TensorLike; // [1, Q, C]
	masks?: TensorLike; // [1, Q, H, W] 마스크 로짓
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 출력 이름이 manifest와 다르더라도 텐서 모양으로 boxes/logits/masks를 찾아낸다. */
export function pickOutputs(
	results: Record<string, TensorLike>,
	names: ModelManifest['outputs']
): DetrOutputs {
	const byName = (name?: string) => (name ? results[name] : undefined);
	const all = Object.values(results);
	const boxes = byName(names.boxes) ?? all.find((t) => t.dims.length === 3 && t.dims[2] === 4);
	const logits =
		byName(names.logits) ?? all.find((t) => t !== boxes && t.dims.length === 3 && t.dims[1] === boxes?.dims[1]);
	const masks = byName(names.masks) ?? all.find((t) => t.dims.length === 4);
	if (!boxes || !logits) {
		const shapes = Object.entries(results).map(([k, t]) => `${k}[${t.dims.join('x')}]`);
		throw new Error(`모델 출력 형식을 인식하지 못했습니다: ${shapes.join(', ')}`);
	}
	return { boxes, logits, masks };
}

export function decodeDetr(outputs: DetrOutputs, manifest: ModelManifest): RawDetection[] {
	const { boxes, logits, masks } = outputs;
	const queries = boxes.dims[1];
	const classCount = logits.dims[2];
	const { minScore, maskLogit = 0 } = manifest.thresholds;

	const candidates: { query: number; category: ComponentCategory; score: number }[] = [];
	for (let q = 0; q < queries; q++) {
		let bestScore = -Infinity;
		let bestClass = -1;
		for (let c = 0; c < classCount; c++) {
			if (!manifest.classes[c]) continue;
			const score = sigmoid(logits.data[q * classCount + c]);
			if (score > bestScore) (bestScore = score), (bestClass = c);
		}
		if (bestClass >= 0 && bestScore >= minScore) {
			candidates.push({ query: q, category: manifest.classes[bestClass]!, score: bestScore });
		}
	}
	candidates.sort((a, b) => b.score - a.score);

	const maskH = masks?.dims[2] ?? 0;
	const maskW = masks?.dims[3] ?? 0;

	return candidates.slice(0, manifest.maxDetections * 2).map(({ query, category, score }) => {
		const o = query * 4;
		const cx = boxes.data[o];
		const cy = boxes.data[o + 1];
		const bw = boxes.data[o + 2];
		const bh = boxes.data[o + 3];
		const x = clamp01(cx - bw / 2);
		const y = clamp01(cy - bh / 2);
		const box: Box = { x, y, width: clamp01(cx + bw / 2) - x, height: clamp01(cy + bh / 2) - y };

		let outline: Point[] | null = null;
		if (masks && maskW && maskH) {
			const plane = maskW * maskH;
			const offset = query * plane;
			const data = masks.data;
			const sliceArray =
				data instanceof Float32Array
					? data.subarray(offset, offset + plane)
					: Float32Array.from({ length: plane }, (_, i) => data[offset + i]);
			// 상자보다 약간 넓은 영역에서만 마스크를 찾는다.
			const padX = box.width * 0.06 * maskW;
			const padY = box.height * 0.06 * maskH;
			outline = maskToPolygon(
				sliceArray,
				maskW,
				maskH,
				{
					x0: box.x * maskW - padX,
					y0: box.y * maskH - padY,
					x1: (box.x + box.width) * maskW + padX,
					y1: (box.y + box.height) * maskH + padY
				},
				maskLogit
			);
		}
		return { category, score, box, outline };
	});
}
