import { CATEGORIES, type ComponentCategory, type LabelReading } from '#lib/types.ts';

const text = (value: unknown, max = 120): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, max);
	return trimmed && !/^(null|unknown|n\/a|none)$/i.test(trimmed) ? trimmed : null;
};

const list = (value: unknown, maxItems = 20): string[] =>
	Array.isArray(value)
		? value.map((item) => text(item)).filter((item): item is string => Boolean(item)).slice(0, maxItems)
		: [];

/** 외부 모델 응답은 신뢰하지 않고 필요한 필드만 검증해 꺼낸다. */
export function sanitizeReading(raw: unknown, provider: string, demo: boolean): LabelReading {
	const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const category = CATEGORIES.includes(data.category as ComponentCategory) ? (data.category as ComponentCategory) : null;
	const legibility = ['clear', 'partial', 'unreadable'].includes(data.legibility as string)
		? (data.legibility as LabelReading['legibility'])
		: 'partial';
	return {
		visibleText: list(data.visibleText, 30),
		manufacturer: text(data.manufacturer, 60),
		model: text(data.model),
		partNumber: text(data.partNumber),
		category,
		legibility,
		notes: list(data.notes, 5),
		provider,
		demo
	};
}
