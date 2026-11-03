import type { ComponentCategory } from './types';

export const CATEGORY_NAMES: Record<ComponentCategory, string> = {
	motherboard: '메인보드',
	gpu: '그래픽카드',
	memory: '메모리',
	storage: '저장장치',
	cpu_cooler: 'CPU 쿨러',
	power_supply: '파워서플라이',
	case_fan: '케이스 팬',
	unknown: '확인 필요'
};

export const CATEGORY_COLORS: Record<ComponentCategory, string> = {
	motherboard: '#8b5cf6',
	gpu: '#ff6b35',
	memory: '#11a979',
	storage: '#3b82f6',
	cpu_cooler: '#e5a000',
	power_supply: '#64748b',
	case_fan: '#06b6d4',
	unknown: '#ef4444'
};

/** 정확한 모델을 확인하려면 어디를 찍어야 하는지 */
export const LABEL_GUIDE: Record<ComponentCategory, string> = {
	motherboard: '메모리 슬롯과 PCIe 슬롯 사이, 또는 보드 가장자리에 인쇄된 모델명을 가까이 찍어주세요.',
	gpu: '그래픽카드 측면 로고나 뒷면 스티커(모델명·시리얼)를 가까이 찍어주세요.',
	memory: '메모리 모듈 측면 스티커가 보이도록 가까이 찍어주세요. 방열판에 가려져 있으면 윗면 각인을 찍어주세요.',
	storage: '저장장치 윗면 스티커를 가까이 찍어주세요. M.2 SSD는 방열판 아래에 있을 수 있습니다.',
	cpu_cooler: '쿨러 상단 로고나 팬 중앙 스티커를 찍어주세요.',
	power_supply: '파워서플라이 측면 스펙 스티커를 찍어주세요. 파워 내부는 절대 열지 마세요.',
	case_fan: '팬 중앙 허브의 스티커를 찍어주세요.',
	unknown: '부품 표면의 로고나 스티커가 보이도록 가까이 찍어주세요.'
};

/** 한 사진에서 정상적으로 나올 수 있는 최대 개수 (중복 탐지 억제용) */
export const CATEGORY_LIMITS: Record<ComponentCategory, number> = {
	motherboard: 1,
	gpu: 2,
	memory: 8,
	storage: 6,
	cpu_cooler: 1,
	power_supply: 1,
	case_fan: 8,
	unknown: 4
};
