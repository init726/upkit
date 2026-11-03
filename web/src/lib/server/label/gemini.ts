import { CATEGORY_NAMES } from '#lib/categories.ts';
import { CATEGORIES, type LabelReading } from '#lib/types.ts';
import { sanitizeReading } from './sanitize';
import { LabelError, type LabelInput, type LabelReader } from './types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function prompt(input: LabelInput) {
	const hint = input.category ? `The user says this is a ${input.category} (${CATEGORY_NAMES[input.category]}).` : '';
	return `You read product labels on PC hardware components from a close-up photo.
${hint}
Rules:
- Transcribe ONLY text that is actually visible. Never guess a model from the component's appearance.
- If a value is not printed or not legible, use null. Do not complete partially visible model numbers.
- "model" is the marketing model name (e.g. "ROG STRIX RTX 4070 SUPER"), "partNumber" is an SKU / P/N if printed.
- "category" must be one of: ${CATEGORIES.join(', ')} — or null if unclear.
- "notes": at most 3 short Korean sentences for the user (e.g. what to re-shoot). Empty array if none.
Respond with JSON only:
{"visibleText": string[], "manufacturer": string|null, "model": string|null, "partNumber": string|null,
 "category": string|null, "legibility": "clear"|"partial"|"unreadable", "notes": string[]}`;
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(binary);
}

/** Gemini API (Google AI Studio). 무료 등급은 한도가 계정별로 다르고 데이터가 학습에 쓰일 수 있다. */
export class GeminiLabelReader implements LabelReader {
	readonly demo = false;
	readonly external = true;
	readonly name: string;

	constructor(
		private apiKey: string,
		private model: string
	) {
		this.name = `gemini:${model}`;
	}

	async read(input: LabelInput): Promise<LabelReading> {
		let response: Response;
		try {
			response = await fetch(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
				signal: AbortSignal.timeout(25_000),
				body: JSON.stringify({
					contents: [
						{
							role: 'user',
							parts: [
								{ inline_data: { mime_type: input.mimeType, data: toBase64(input.image) } },
								{ text: prompt(input) }
							]
						}
					],
					generationConfig: { temperature: 0, responseMimeType: 'application/json' }
				})
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError')
				throw new LabelError('timeout', '라벨 분석 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.', 504);
			throw new LabelError('provider_error', '라벨 분석 서비스에 연결하지 못했습니다.');
		}

		if (response.status === 429)
			throw new LabelError('rate_limited', '무료 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.', 429);
		if (!response.ok) {
			console.error('[label] Gemini error', response.status, await response.text().catch(() => ''));
			throw new LabelError('provider_error', '라벨 분석 서비스에서 오류가 발생했습니다.');
		}

		const body = (await response.json()) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		};
		const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
		try {
			const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
			return sanitizeReading(JSON.parse(json), this.name, false);
		} catch {
			throw new LabelError('invalid_response', '라벨 분석 결과를 해석하지 못했습니다. 다시 찍어주세요.');
		}
	}
}
