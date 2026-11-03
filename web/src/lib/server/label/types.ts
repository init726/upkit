import type { ComponentCategory, LabelReading } from '#lib/types.ts';

export interface LabelInput {
	image: Uint8Array;
	mimeType: string;
	/** 사용자가 선택한 부품 (프롬프트 힌트용) */
	category: ComponentCategory | null;
}

/** 라벨 사진 → 텍스트/모델 후보. 제공자는 언제든 교체할 수 있도록 이 인터페이스만 구현한다. */
export interface LabelReader {
	readonly name: string;
	readonly demo: boolean;
	/** 사진이 외부 서비스로 전송되는지 (UI 동의 문구에 사용) */
	readonly external: boolean;
	read(input: LabelInput): Promise<LabelReading>;
}

export class LabelError extends Error {
	constructor(
		readonly code: 'rate_limited' | 'provider_error' | 'invalid_response' | 'timeout',
		message: string,
		readonly status = 502
	) {
		super(message);
	}
}
