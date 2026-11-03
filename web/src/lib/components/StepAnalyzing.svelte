<script lang="ts">
	import { Check, LoaderCircle } from '@lucide/svelte';
	import type { AnalyzerProgress } from '#lib/vision/analyzer.ts';
	import type { Photo } from '#lib/vision/image.ts';

	let { photo, progress, demo }: { photo: Photo; progress: AnalyzerProgress | null; demo: boolean } = $props();

	type StageKey = 'model' | 'inference' | 'postprocess';
	const order: StageKey[] = ['model', 'inference', 'postprocess'];

	const current = $derived<StageKey>(
		!progress || progress.stage === 'download' || progress.stage === 'compile' ? 'model' : progress.stage
	);

	const modelLabel = $derived.by(() => {
		if (demo) return '데모 분석기 준비';
		if (progress?.stage === 'download')
			return progress.ratio !== undefined ? `AI 모델 내려받는 중 ${Math.round(progress.ratio * 100)}%` : 'AI 모델 내려받는 중';
		if (progress?.stage === 'compile') return 'AI 모델 준비 중';
		return 'AI 모델 준비';
	});

	const stages = $derived([
		{ key: 'model' as const, label: modelLabel },
		{ key: 'inference' as const, label: '부품 찾는 중' },
		{ key: 'postprocess' as const, label: '외곽선 정리' }
	]);

	const stageState = (key: StageKey) => {
		const diff = order.indexOf(key) - order.indexOf(current);
		return diff < 0 ? 'done' : diff === 0 ? 'active' : 'todo';
	};
</script>

<section class="analyzing" aria-live="polite">
	<div class="stage card">
		<img src={photo.url} alt="분석 중인 사진" style="aspect-ratio: {photo.width} / {photo.height}" />
		<div class="scan" aria-hidden="true"></div>
	</div>

	<ol>
		{#each stages as stage (stage.key)}
			<li class={stageState(stage.key)}>
				<span class="dot">
					{#if stageState(stage.key) === 'done'}<Check size={14} strokeWidth={3} />
					{:else if stageState(stage.key) === 'active'}<LoaderCircle size={14} class="spin" />{/if}
				</span>
				{stage.label}
			</li>
		{/each}
	</ol>
	<p class="muted note">처음 한 번은 AI 모델을 내려받느라 시간이 걸릴 수 있어요. 이후에는 바로 시작됩니다.</p>
</section>

<style>
	.analyzing {
		display: grid;
		gap: 20px;
		max-width: 560px;
		margin: 0 auto;
		padding: 16px 0 48px;
	}

	.stage {
		position: relative;
		overflow: hidden;
		padding: 0;
	}

	.stage img {
		width: 100%;
		max-height: 56vh;
		object-fit: contain;
		background: var(--surface-2);
		filter: saturate(0.6) brightness(0.85);
	}

	.scan {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 0%, rgb(255 107 53 / 0.28) 48%, rgb(255 107 53 / 0.9) 50%, transparent 51%);
		background-size: 100% 200%;
		animation: scan 2.2s ease-in-out infinite;
	}

	@keyframes scan {
		from {
			background-position: 0 100%;
		}
		to {
			background-position: 0 -100%;
		}
	}

	ol {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		color: var(--ink-3);
	}

	li.active {
		color: var(--ink);
	}

	li.done {
		color: var(--ink-2);
	}

	.dot {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid var(--line);
	}

	li.active .dot {
		border-color: var(--accent);
		color: var(--accent);
	}

	li.done .dot {
		background: var(--ok);
		border-color: var(--ok);
		color: #fff;
	}

	.note {
		font-size: 13px;
	}
</style>
