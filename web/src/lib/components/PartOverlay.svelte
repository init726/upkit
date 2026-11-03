<script lang="ts">
	import { CATEGORY_COLORS, CATEGORY_NAMES } from '#lib/categories.ts';
	import type { Detection } from '#lib/types.ts';
	import type { Photo } from '#lib/vision/image.ts';

	let {
		photo,
		detections,
		selectedId,
		focus,
		onSelect
	}: {
		photo: Photo;
		detections: Detection[];
		selectedId: string | null;
		focus: boolean;
		onSelect: (id: string) => void;
	} = $props();

	const w = $derived(photo.width);
	const h = $derived(photo.height);

	function polygon(d: Detection): string {
		const points = d.outline?.length
			? d.outline
			: [
					{ x: d.boundingBox.x, y: d.boundingBox.y },
					{ x: d.boundingBox.x + d.boundingBox.width, y: d.boundingBox.y },
					{ x: d.boundingBox.x + d.boundingBox.width, y: d.boundingBox.y + d.boundingBox.height },
					{ x: d.boundingBox.x, y: d.boundingBox.y + d.boundingBox.height }
				];
		return points.map((p) => `${(p.x * w).toFixed(1)},${(p.y * h).toFixed(1)}`).join(' ');
	}

	const selected = $derived(detections.find((d) => d.id === selectedId) ?? null);
	const dimOthers = $derived(focus && selected !== null);

	// 선택한 부품을 위로 그려서 겹친 영역에서도 클릭되도록 한다.
	const ordered = $derived([...detections].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId)));

	function onKey(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(id);
		}
	}

	const chipPosition = (d: Detection) => ({
		left: Math.min(Math.max(d.boundingBox.x * 100, 0), 92),
		top: Math.min(Math.max(d.boundingBox.y * 100, 0), 94)
	});
</script>

<div class="frame" style="--ratio: {w / h}">
	<div class="stage" style="aspect-ratio: {w} / {h}">
		<img src={photo.url} alt="분석한 PC 내부 사진" draggable="false" />

		<svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" role="group" aria-label="탐지된 부품 윤곽선">
			{#if dimOthers && selected}
				<defs>
					<mask id="focus-mask">
						<rect width={w} height={h} fill="white" />
						<polygon points={polygon(selected)} fill="black" />
					</mask>
				</defs>
				<rect width={w} height={h} fill="rgb(6 10 8 / 0.62)" mask="url(#focus-mask)" pointer-events="none" />
			{/if}

			{#each ordered as d (d.id)}
				<polygon
					points={polygon(d)}
					class="part"
					class:selected={d.id === selectedId}
					class:faded={dimOthers && d.id !== selectedId}
					style="--c: {CATEGORY_COLORS[d.category]}"
					role="button"
					tabindex="0"
					aria-label="{CATEGORY_NAMES[d.category]} 선택"
					aria-pressed={d.id === selectedId}
					onclick={() => onSelect(d.id)}
					onkeydown={(event) => onKey(event, d.id)}
				/>
			{/each}
		</svg>

		{#each detections as d (d.id)}
			{@const pos = chipPosition(d)}
			{#if !dimOthers || d.id === selectedId}
				<button
					class="chip"
					class:selected={d.id === selectedId}
					style="left: {pos.left}%; top: {pos.top}%; --c: {CATEGORY_COLORS[d.category]}"
					onclick={() => onSelect(d.id)}
					tabindex="-1"
				>
					{CATEGORY_NAMES[d.category]}
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.frame {
		display: flex;
		justify-content: center;
		background: #0b0f0d;
		border-radius: var(--radius);
		overflow: hidden;
	}

	.stage {
		position: relative;
		/* 높이 70vh 안에 들어오도록 너비를 비율에 맞춰 제한 */
		width: min(100%, calc(70vh * var(--ratio)));
		user-select: none;
	}

	img,
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.part {
		fill: color-mix(in srgb, var(--c) 18%, transparent);
		stroke: var(--c);
		stroke-width: 2.5;
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
		cursor: pointer;
		outline: none;
		transition:
			fill 0.15s,
			opacity 0.2s;
	}

	.part:hover,
	.part:focus-visible {
		fill: color-mix(in srgb, var(--c) 32%, transparent);
	}

	.part.selected {
		fill: color-mix(in srgb, var(--c) 28%, transparent);
		stroke-width: 4;
		filter: drop-shadow(0 0 6px var(--c));
	}

	.part.faded {
		opacity: 0;
		pointer-events: none;
	}

	.chip {
		position: absolute;
		transform: translateY(-50%);
		padding: 3px 9px;
		border: 0;
		border-radius: 999px;
		background: var(--c);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
	}

	.chip.selected {
		outline: 2px solid #fff;
	}

	@media (max-width: 480px) {
		.chip {
			font-size: 11px;
			padding: 2px 7px;
		}
	}
</style>
