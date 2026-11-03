import { defineEnvVars } from '@sveltejs/kit/env';

const PROVIDERS = ['auto', 'gemini', 'demo'] as const;
type Provider = (typeof PROVIDERS)[number];

export const variables = defineEnvVars({
	LABEL_PROVIDER: {
		description: '라벨 읽기 제공자: auto(키가 있으면 gemini) | gemini | demo',
		schema: (value): Provider => {
			if (!value) return 'auto';
			if (!PROVIDERS.includes(value as Provider)) throw new Error(`LABEL_PROVIDER는 ${PROVIDERS.join(', ')} 중 하나여야 합니다.`);
			return value as Provider;
		}
	},
	GEMINI_API_KEY: {
		description: 'Google AI Studio Gemini API 키 (서버 전용)',
		schema: (value) => value || undefined
	},
	GEMINI_MODEL: {
		description: '라벨 읽기에 사용할 Gemini 모델',
		schema: (value) => value || 'gemini-flash-latest'
	}
});
