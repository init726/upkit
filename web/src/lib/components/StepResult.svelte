<script lang="ts">
	import { Camera, Check, ChevronRight, Eye, Focus, Info, TriangleAlert } from '@lucide/svelte';
	import { CATEGORY_COLORS, CATEGORY_NAMES } from '#lib/categories.ts';
	import { readLabel, type LabelServiceStatus, type LabelState } from '#lib/label.ts';
	import type { AnalysisResult } from '#lib/types.ts';
	import type { Photo } from '#lib/vision/image.ts';
	import PartOverlay from './PartOverlay.svelte';
	import PartPanel from './PartPanel.svelte';

	let {
		photo,
		result,
		service,
		onRetake
	}: {
		photo: Photo;
		result: AnalysisResult;
		service: LabelServiceStatus | null;
		onRetake: () => void;
	} = $props();

	let selectedId = $state<string | null>(null);
	let focus = $state(false);
	let labels = $state<Record<string, LabelState>>({});
	let panelEl = $state<HTMLElement>();

	$effect.pre(() => {
		// 새 결과가 들어오면 첫 부품을 선택하고 라벨 상태를 초기화한다.
		const first = result.detections[0]?.id ?? null;
		selectedId = first;
		labels = {};
		focus = false;
	});

	const selected = $derived(result.detections.find((d) => d.id === selectedId) ?? null);
	const confirmedCount = $derived(Object.values(labels).filter((l) => l.confirmed).length);

	function select(id: string) {
		selectedId = id;
		if (matchMedia('(max-width: 899px)').matches) {
			panelEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	async function onLabelFile(file: File) {
		if (!selected) return;
		const { id, category } = selected;
		labels[id] = { status: 'reading' };
		try {
			const reading = await readLabel(file, category);
			labels[id] = { status: 'done', reading };
		} catch (error) {
			labels[id] = { status: 'error', error: error instanceof Error ? error.message : '라벨을 읽지 못했습니다.' };
		}
	}

	function onConfirm(value: boolean | undefined) {
		if (!selected) return;
		const current = labels[selected.id];
		if (current) labels[selected.id] = { ...current, confirmed: value };
	}

	const engineText = $derived.by(() => {
		const { engine } = result;
		if (engine.kind === 'demo') return '데모 분석기';
		const backend = engine.backend === 'webgpu' ? 'WebGPU' : 'WASM';
		return `${engine.name} · ${backend} · 추론 ${engine.timings.inferenceMs}ms`;
	});
</script>

<section class="result">
	<div class="visual">
		{#if result.detections.length}
			<PartOverlay {photo} detections={result.detections} {selectedId} {focus} onSelect={select} />
			<div class="toolbar">
				<div class="segmented" role="radiogroup" aria-label="보기 방식">
					<button role="radio" aria-checked={!focus} class:on={!focus} onclick={() => (focus = false)}>
						<Eye size={16} /> 전체 보기
					</button>
					<button role="radio" aria-checked={focus} class:on={focus} onclick={() => (focus = true)}>
						<Focus size={16} /> 선택 부품만
					</button>
				</div>
				<button class="btn btn-ghost" onclick={onRetake}><Camera size={16} /> 다시 찍기</button>
			</div>
		{:else}
			<div class="empty card">
				<img src={photo.url} alt="분석한 사진" />
				<div class="notice notice-warn"><TriangleAlert size={18} />부품을 찾지 못했어요.</div>
				<button class="btn btn-primary" onclick={onRetake}><Camera size={18} /> 다시 찍기</button>
			</div>
		{/if}
	</div>

	<aside class="side">
		<div class="summary">
			<p class="eyebrow">분석 결과</p>
			<h2>
				{#if result.detections.length}부품 {result.detections.length}개를 찾았어요{:else}다시 찍어주세요{/if}
			</h2>
			<p class="engine muted">{engineText}</p>
		</div>

		{#each result.warnings as warning (warning)}
			<div class="notice {result.engine.kind === 'demo' && warning.includes('데모') ? 'notice-warn' : 'notice-info'}">
				<Info size={16} />{warning}
			</div>
		{/each}

		{#if result.detections.length}
			<ul class="parts" aria-label="찾은 부품">
				{#each result.detections as d (d.id)}
					<li>
						<button class:on={d.id === selectedId} style="--c: {CATEGORY_COLORS[d.category]}" onclick={() => select(d.id)}>
							<span class="swatch" aria-hidden="true"></span>
							<span class="name">{CATEGORY_NAMES[d.category]}</span>
							{#if labels[d.id]?.confirmed}
								<span class="model">{labels[d.id].reading?.model ?? labels[d.id].reading?.manufacturer ?? ''}</span>
								<Check size={16} class="ok-icon" />
							{:else}
								<span class="pct muted">{Math.round(d.confidence * 100)}%</span>
							{/if}
							<ChevronRight size={16} class="chev" />
						</button>
					</li>
				{/each}
			</ul>
			<p class="progress muted">정확한 모델 확인 {confirmedCount} / {result.detections.length}</p>
		{/if}

		<div bind:this={panelEl} class="panel-anchor">
			{#if selected}
				{#key selected.id}
					<PartPanel
						detection={selected}
						label={labels[selected.id] ?? { status: 'idle' }}
						{service}
						{onLabelFile}
						{onConfirm}
					/>
				{/key}
			{/if}
		</div>
	</aside>
</section>

<style>
	.result {
		display: grid;
		gap: 20px;
		padding: 8px 0 48px;
	}

	@media (min-width: 900px) {
		.result {
			grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr);
			align-items: start;
		}

		.visual {
			position: sticky;
			top: 12px;
		}
	}

	.visual {
		display: grid;
		gap: 10px;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.segmented {
		display: inline-flex;
		padding: 4px;
		border-radius: 999px;
		background: var(--surface-2);
	}

	.segmented button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 38px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--ink-2);
		font-size: 14px;
		font-weight: 650;
		cursor: pointer;
	}

	.segmented button.on {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
	}

	.empty {
		display: grid;
		gap: 12px;
		padding: 12px;
	}

	.empty img {
		width: 100%;
		max-height: 50vh;
		object-fit: contain;
		border-radius: 12px;
	}

	.side {
		display: grid;
		gap: 12px;
		align-content: start;
	}

	.summary {
		display: grid;
		gap: 4px;
	}

	h2 {
		font-size: 24px;
	}

	.engine {
		font-size: 13px;
	}

	.parts {
		display: grid;
		gap: 6px;
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
	}

	.parts button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 52px;
		padding: 0 14px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--surface);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.15s;
	}

	.parts button:hover {
		border-color: var(--ink-3);
	}

	.parts button.on {
		border-color: var(--c);
		box-shadow: inset 4px 0 0 var(--c);
	}

	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		background: var(--c);
		flex: none;
	}

	.name {
		font-weight: 650;
	}

	.model {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
		color: var(--ink-2);
		text-align: right;
	}

	.pct {
		margin-left: auto;
		font-size: 13px;
	}

	.parts :global(.ok-icon) {
		color: var(--ok);
		flex: none;
	}

	.parts :global(.chev) {
		color: var(--ink-3);
		flex: none;
	}

	.progress {
		font-size: 13px;
	}

	.panel-anchor {
		scroll-margin-top: 12px;
	}
</style>
