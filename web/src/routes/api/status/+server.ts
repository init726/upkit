import { json } from '@sveltejs/kit';
import { getLabelReader } from '#lib/server/label/index.ts';
import type { RequestHandler } from './$types';

export interface ServiceStatus {
	label: { provider: string; demo: boolean; external: boolean };
}

export const GET: RequestHandler = () => {
	const reader = getLabelReader();
	return json({
		label: { provider: reader.name, demo: reader.demo, external: reader.external }
	} satisfies ServiceStatus);
};
