import type { ImageQuality, QualityIssue } from '#lib/types.ts';
import { drawScaled } from './image';

/**
 * AI 없이 계산하는 촬영 품질 검사.
 * 임계값은 긴 변 320px로 축소한 이미지 기준의 경험값이며, 실제 사진으로 보정해야 한다.
 */
const SAMPLE_SIDE = 320;
const THRESHOLDS = {
	dark: 55,
	overexposed: 210,
	blurry: 45,
	minShortSide: 600
};

export const QUALITY_MESSAGES: Record<QualityIssue, string> = {
	dark: '사진이 어둡습니다. 조명을 켜거나 휴대폰 손전등을 비춰주세요.',
	overexposed: '빛 반사가 심합니다. 강화유리 패널을 열고 각도를 조금 바꿔주세요.',
	blurry: '사진이 흔들렸습니다. 휴대폰을 고정하고 초점을 맞춘 뒤 다시 찍어주세요.',
	low_resolution: '해상도가 낮습니다. 원본 크기의 사진을 사용해주세요.',
	no_parts: '부품을 찾지 못했습니다. 측면 패널을 열고 메인보드 면 전체가 보이도록 찍어주세요.'
};

export function assessQuality(bitmap: ImageBitmap): ImageQuality {
	const { ctx, width, height } = drawScaled(bitmap, SAMPLE_SIDE);
	const { data } = ctx.getImageData(0, 0, width, height);

	const gray = new Float32Array(width * height);
	let sum = 0;
	for (let i = 0; i < gray.length; i++) {
		const value = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
		gray[i] = value;
		sum += value;
	}
	const brightness = sum / gray.length;

	// 4-이웃 라플라시안의 분산: 초점이 맞지 않거나 흔들린 사진일수록 작다.
	let lapSum = 0;
	let lapSq = 0;
	let count = 0;
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const i = y * width + x;
			const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
			lapSum += lap;
			lapSq += lap * lap;
			count++;
		}
	}
	const mean = count ? lapSum / count : 0;
	const sharpness = count ? lapSq / count - mean * mean : 0;

	const issues: QualityIssue[] = [];
	if (brightness < THRESHOLDS.dark) issues.push('dark');
	if (brightness > THRESHOLDS.overexposed) issues.push('overexposed');
	if (sharpness < THRESHOLDS.blurry) issues.push('blurry');
	if (Math.min(bitmap.width, bitmap.height) < THRESHOLDS.minShortSide) issues.push('low_resolution');

	return {
		usable: issues.length === 0,
		issues,
		metrics: {
			width: bitmap.width,
			height: bitmap.height,
			brightness: Math.round(brightness),
			sharpness: Math.round(sharpness)
		}
	};
}
