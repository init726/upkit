import { json } from '@sveltejs/kit';
import { LabelError, getLabelReader } from '#lib/server/label/index.ts';
import { CATEGORIES, type ApiError, type ComponentCategory } from '#lib/types.ts';
import type { RequestHandler } from './$types';

const MAX_BYTES = 500_000;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fail = (status: number, code: string, message: string) =>
	json({ error: { code, message } } satisfies ApiError, { status });

/** 라벨 확대 사진 한 장을 받아 보이는 문자와 모델 후보를 돌려준다. */
export const POST: RequestHandler = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return fail(400, 'invalid_request', '라벨 사진이 필요합니다.');
	}

	const image = form.get('image');
	if (!(image instanceof File)) return fail(400, 'invalid_request', '라벨 사진이 필요합니다.');
	if (!MIME_TYPES.has(image.type)) return fail(415, 'unsupported_type', 'JPEG, PNG, WebP 사진만 지원합니다.');
	if (image.size > MAX_BYTES) return fail(413, 'too_large', '사진 용량이 너무 큽니다.');

	const rawCategory = form.get('category');
	const category = CATEGORIES.includes(rawCategory as ComponentCategory) ? (rawCategory as ComponentCategory) : null;

	try {
		const reading = await getLabelReader().read({
			image: new Uint8Array(await image.arrayBuffer()),
			mimeType: image.type,
			category
		});
		return json(reading);
	} catch (error) {
		if (error instanceof LabelError) return fail(error.status, error.code, error.message);
		console.error('[label] unexpected error', error);
		return fail(500, 'internal_error', '라벨을 분석하지 못했습니다.');
	}
};
