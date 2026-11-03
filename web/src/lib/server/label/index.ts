import { GEMINI_API_KEY, GEMINI_MODEL, LABEL_PROVIDER } from '$app/env/private';
import { DemoLabelReader } from './demo';
import { GeminiLabelReader } from './gemini';
import type { LabelReader } from './types';

export { LabelError } from './types';

let reader: LabelReader | null = null;

export function getLabelReader(): LabelReader {
	if (reader) return reader;
	const useGemini = LABEL_PROVIDER === 'gemini' || (LABEL_PROVIDER === 'auto' && GEMINI_API_KEY);
	if (useGemini) {
		if (!GEMINI_API_KEY) throw new Error('LABEL_PROVIDER=gemini 이지만 GEMINI_API_KEY가 없습니다.');
		reader = new GeminiLabelReader(GEMINI_API_KEY, GEMINI_MODEL);
	} else {
		reader = new DemoLabelReader();
	}
	return reader;
}
