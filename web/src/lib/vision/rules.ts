import { CATEGORY_LIMITS, CATEGORY_NAMES, LABEL_GUIDE } from '#lib/categories.ts';
import type { Box, ComponentCategory, Detection } from '#lib/types.ts';
import type { RawDetection } from './onnx/postprocess';

export interface RuleThresholds {
	unknownBelow: number;
	confirmBelow: number;
}

export function iou(a: Box, b: Box): number {
	const x1 = Math.max(a.x, b.x);
	const y1 = Math.max(a.y, b.y);
	const x2 = Math.min(a.x + a.width, b.x + b.width);
	const y2 = Math.min(a.y + a.height, b.y + b.height);
	const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
	const union = a.width * a.height + b.width * b.height - intersection;
	return union > 0 ? intersection / union : 0;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * 모델 출력을 사용자에게 보여줄 탐지 목록으로 바꾼다.
 * - 같은 대상을 여러 번 잡은 결과 제거
 * - 한 사진에 나올 수 없는 개수 제한
 * - 점수가 낮으면 카테고리를 단정하지 않고 unknown으로 표시
 */
export function applyRules(raw: RawDetection[], thresholds: RuleThresholds, maxDetections: number): Detection[] {
	const accepted: RawDetection[] = [];
	const counts = new Map<ComponentCategory, number>();

	for (const item of [...raw].sort((a, b) => b.score - a.score)) {
		const duplicate = accepted.some((other) => {
			const overlap = iou(item.box, other.box);
			return other.category === item.category ? overlap > 0.5 : overlap > 0.85;
		});
		if (duplicate) continue;
		const count = counts.get(item.category) ?? 0;
		if (count >= CATEGORY_LIMITS[item.category]) continue;
		counts.set(item.category, count + 1);
		accepted.push(item);
		if (accepted.length >= maxDetections) break;
	}

	const serial = new Map<ComponentCategory, number>();
	return accepted.map((item) => {
		const uncertain = item.score < thresholds.unknownBelow;
		const category: ComponentCategory = uncertain ? 'unknown' : item.category;
		const index = (serial.get(category) ?? 0) + 1;
		serial.set(category, index);

		const observations = [`기기 내 모델 점수 ${percent(item.score)}`];
		if (uncertain) observations.push(`가장 가까운 후보는 ${CATEGORY_NAMES[item.category]}이지만 확신할 수 없습니다.`);
		observations.push(item.outline ? '분할 마스크를 따라 외곽선을 그렸습니다.' : '마스크가 없어 상자 영역으로 표시합니다.');

		return {
			id: `${category}-${index}`,
			category,
			confidence: Number(item.score.toFixed(4)),
			boundingBox: item.box,
			outline: item.outline ?? undefined,
			visibleText: [],
			observations,
			manufacturerCandidates: [],
			productCandidates: [],
			needsConfirmation: uncertain || item.score < thresholds.confirmBelow,
			requestedPhoto: LABEL_GUIDE[uncertain ? item.category : category]
		};
	});
}
