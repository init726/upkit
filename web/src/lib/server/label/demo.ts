import type { LabelReading } from '#lib/types.ts';
import { sanitizeReading } from './sanitize';
import type { LabelInput, LabelReader } from './types';

/** API 키 없이 화면 흐름을 확인하기 위한 라벨 읽기. 사진은 어디에도 전송되지 않는다. */
export class DemoLabelReader implements LabelReader {
	readonly name = 'demo';
	readonly demo = true;
	readonly external = false;

	async read(input: LabelInput): Promise<LabelReading> {
		await new Promise((resolve) => setTimeout(resolve, 900));
		return sanitizeReading(
			{
				visibleText: ['EXAMPLE', 'MODEL-1234', 'S/N 0000000000'],
				manufacturer: 'EXAMPLE',
				model: 'MODEL-1234',
				partNumber: null,
				category: input.category,
				legibility: 'partial',
				notes: ['데모 결과입니다. GEMINI_API_KEY를 설정하면 실제 라벨을 읽습니다.']
			},
			this.name,
			true
		);
	}
}
