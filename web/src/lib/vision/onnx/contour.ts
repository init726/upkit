import type { Point } from '#lib/types.ts';

export interface Roi {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

// 8방향, 화면 좌표(y 아래) 기준 시계 방향: E, SE, S, SW, W, NW, N, NE
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];
const WEST = 4;

function directionOf(dx: number, dy: number): number {
	for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
	return WEST;
}

/** 4-연결 기준 가장 큰 덩어리만 남긴다. */
function largestComponent(grid: Uint8Array, w: number, h: number): { keep: Uint8Array; size: number } {
	const labels = new Int32Array(w * h);
	const stack = new Int32Array(w * h);
	let best = 0;
	let bestSize = 0;
	let next = 0;
	for (let start = 0; start < grid.length; start++) {
		if (!grid[start] || labels[start]) continue;
		next++;
		let size = 0;
		let top = 0;
		stack[top++] = start;
		labels[start] = next;
		while (top) {
			const i = stack[--top];
			size++;
			const x = i % w;
			const y = (i - x) / w;
			if (x > 0 && grid[i - 1] && !labels[i - 1]) (labels[i - 1] = next), (stack[top++] = i - 1);
			if (x < w - 1 && grid[i + 1] && !labels[i + 1]) (labels[i + 1] = next), (stack[top++] = i + 1);
			if (y > 0 && grid[i - w] && !labels[i - w]) (labels[i - w] = next), (stack[top++] = i - w);
			if (y < h - 1 && grid[i + w] && !labels[i + w]) (labels[i + w] = next), (stack[top++] = i + w);
		}
		if (size > bestSize) (bestSize = size), (best = next);
	}
	const keep = new Uint8Array(w * h);
	if (best) for (let i = 0; i < keep.length; i++) keep[i] = labels[i] === best ? 1 : 0;
	return { keep, size: bestSize };
}

/** Moore-neighbor 경계 추적. 덩어리의 바깥 경계를 시계 방향 픽셀 목록으로 반환한다. */
function traceBoundary(keep: Uint8Array, w: number, h: number): [number, number][] {
	const start = keep.indexOf(1);
	if (start < 0) return [];
	const sx = start % w;
	const sy = (start - sx) / w;
	const fg = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && keep[y * w + x] === 1;

	const points: [number, number][] = [[sx, sy]];
	let cx = sx;
	let cy = sy;
	let back = WEST; // 래스터 순서상 첫 픽셀의 서쪽은 항상 배경
	const limit = 4 * w * h + 8;
	for (let step = 0; step < limit; step++) {
		let moved = false;
		for (let k = 1; k <= 8; k++) {
			const d = (back + k) % 8;
			const nx = cx + DX[d];
			const ny = cy + DY[d];
			if (fg(nx, ny)) {
				const prev = (d + 7) % 8;
				const bx = cx + DX[prev];
				const by = cy + DY[prev];
				cx = nx;
				cy = ny;
				back = directionOf(bx - cx, by - cy);
				moved = true;
				break;
			}
		}
		if (!moved || (cx === sx && cy === sy)) break;
		points.push([cx, cy]);
	}
	return points;
}

function perpendicularDistance(p: [number, number], a: [number, number], b: [number, number]) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length = Math.hypot(dx, dy);
	if (!length) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

/** Ramer–Douglas–Peucker 단순화 (반복 구현) */
function simplify(points: [number, number][], epsilon: number): [number, number][] {
	if (points.length < 3) return points;
	const keep = new Uint8Array(points.length);
	keep[0] = keep[points.length - 1] = 1;
	const stack: [number, number][] = [[0, points.length - 1]];
	while (stack.length) {
		const [first, last] = stack.pop()!;
		let index = -1;
		let max = 0;
		for (let i = first + 1; i < last; i++) {
			const distance = perpendicularDistance(points[i], points[first], points[last]);
			if (distance > max) (max = distance), (index = i);
		}
		if (index >= 0 && max > epsilon) {
			keep[index] = 1;
			stack.push([first, index], [index, last]);
		}
	}
	return points.filter((_, i) => keep[i]);
}

/**
 * 저해상도 마스크(로짓 또는 확률)를 정규화된 외곽선 다각형으로 바꾼다.
 * roi 밖은 무시해 다른 부품으로 번진 마스크 조각을 잘라낸다.
 */
export function maskToPolygon(
	mask: ArrayLike<number>,
	width: number,
	height: number,
	roi: Roi,
	threshold: number,
	maxPoints = 48
): Point[] | null {
	const x0 = Math.max(0, Math.floor(roi.x0));
	const y0 = Math.max(0, Math.floor(roi.y0));
	const x1 = Math.min(width, Math.ceil(roi.x1));
	const y1 = Math.min(height, Math.ceil(roi.y1));
	const w = x1 - x0;
	const h = y1 - y0;
	if (w < 2 || h < 2) return null;

	const grid = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) grid[y * w + x] = mask[(y0 + y) * width + x0 + x] > threshold ? 1 : 0;
	}
	const { keep, size } = largestComponent(grid, w, h);
	if (size < 6) return null;

	const boundary = traceBoundary(keep, w, h);
	if (boundary.length < 3) return null;

	const closed: [number, number][] = [...boundary, boundary[0]];
	let perimeter = 0;
	for (let i = 1; i < closed.length; i++)
		perimeter += Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]);

	let epsilon = Math.max(0.75, perimeter * 0.006);
	let simplified = simplify(closed, epsilon).slice(0, -1);
	while (simplified.length > maxPoints) {
		epsilon *= 1.4;
		simplified = simplify(closed, epsilon).slice(0, -1);
	}
	if (simplified.length < 3) return null;

	return simplified.map(([x, y]) => ({ x: (x0 + x + 0.5) / width, y: (y0 + y + 0.5) / height }));
}
