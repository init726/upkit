import type { ApiError, ComponentCategory, LabelReading } from './types';
import { toUploadJpeg } from './vision/image';

export interface LabelState {
	status: 'idle' | 'reading' | 'done' | 'error';
	reading?: LabelReading;
	error?: string;
	/** 사용자가 라벨 결과를 확인했는지 (true: 맞음, false: 아님) */
	confirmed?: boolean;
}

export interface LabelServiceStatus {
	provider: string;
	demo: boolean;
	/** 라벨 사진이 외부 AI 서비스로 전송되는지 */
	external: boolean;
}

export async function readLabel(file: File, category: ComponentCategory): Promise<LabelReading> {
	const form = new FormData();
	form.append('image', await toUploadJpeg(file), 'label.jpg');
	form.append('category', category);
	const response = await fetch('/api/label', { method: 'POST', body: form });
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error.message ?? '라벨을 분석하지 못했습니다.');
	}
	return response.json();
}
