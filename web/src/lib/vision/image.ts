export interface Photo {
	file: File;
	/** 화면 표시용 object URL */
	url: string;
	/** EXIF 회전이 적용된 비트맵 (<img>의 기본 표시 방향과 일치) */
	bitmap: ImageBitmap;
	width: number;
	height: number;
}

export async function loadPhoto(file: File): Promise<Photo> {
	if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 선택할 수 있습니다.');
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	return { file, url: URL.createObjectURL(file), bitmap, width: bitmap.width, height: bitmap.height };
}

export function releasePhoto(photo: Photo | null) {
	if (!photo) return;
	URL.revokeObjectURL(photo.url);
	photo.bitmap.close();
}

export async function hashFile(file: Blob): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

function makeCanvas(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas를 사용할 수 없는 브라우저입니다.');
	return { canvas, ctx };
}

/** 긴 변을 maxSide 이하로 줄여 그린 캔버스 */
export function drawScaled(bitmap: ImageBitmap, maxSide: number) {
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const { canvas, ctx } = makeCanvas(width, height);
	ctx.drawImage(bitmap, 0, 0, width, height);
	return { canvas, ctx, width, height };
}

/**
 * 서버로 보낼 라벨 사진을 줄인다. SvelteKit 기본 요청 본문 제한(512KB)을 넘지 않도록
 * 품질을 단계적으로 낮춘다.
 */
export async function toUploadJpeg(file: File, maxSide = 1280, maxBytes = 450_000): Promise<Blob> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	try {
		let side = maxSide;
		for (let attempt = 0; attempt < 6; attempt++) {
			const { canvas } = drawScaled(bitmap, side);
			const quality = Math.max(0.55, 0.88 - attempt * 0.08);
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
			if (!blob) break;
			if (blob.size <= maxBytes) return blob;
			if (quality <= 0.6) side = Math.round(side * 0.8);
		}
		throw new Error('사진을 전송 가능한 크기로 줄이지 못했습니다.');
	} finally {
		bitmap.close();
	}
}
