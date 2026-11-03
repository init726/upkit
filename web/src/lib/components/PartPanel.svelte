<script lang="ts">
	import { Camera, Check, CircleAlert, ImagePlus, LoaderCircle, RotateCcw, Tag, X } from '@lucide/svelte';
	import { CATEGORY_COLORS, CATEGORY_NAMES } from '#lib/categories.ts';
	import type { LabelServiceStatus, LabelState } from '#lib/label.ts';
	import type { Detection } from '#lib/types.ts';

	let {
		detection,
		label,
		service,
		onLabelFile,
		onConfirm
	}: {
		detection: Detection;
		label: LabelState;
		service: LabelServiceStatus | null;
		onLabelFile: (file: File) => void;
		onConfirm: (value: boolean | undefined) => void;
	} = $props();

	let cameraInput: HTMLInputElement;
	let galleryInput: HTMLInputElement;

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) onLabelFile(file);
	}

	const color = $derived(CATEGORY_COLORS[detection.category]);
	const score = $derived(Math.round(detection.confidence * 100));
	const reading = $derived(label.reading);
	const mismatch = $derived(
		reading?.category && detection.category !== 'unknown' && reading.category !== detection.category
	);
	const legibilityText = { clear: '선명하게 읽힘', partial: '일부만 읽힘', unreadable: '읽을 수 없음' } as const;
</script>

<article class="panel card" style="--c: {color}">
	<header>
		<span class="swatch" aria-hidden="true"></span>
		<h3>{CATEGORY_NAMES[detection.category]}</h3>
		{#if label.confirmed}
			<span class="tag ok"><Check size={13} strokeWidth={3} /> 확인됨</span>
		{:else if detection.needsConfirmation}
			<span class="tag warn">확인 필요</span>
		{/if}
	</header>

	<div class="score">
		<div class="score-row">
			<span class="muted">모델 점수</span>
			<strong>{score}%</strong>
		</div>
		<div class="bar"><span style="width: {score}%"></span></div>
		<small class="muted">AI가 얼마나 확신하는지를 나타내며, 정답일 확률과는 다릅니다.</small>
	</div>

	{#if detection.observations.length}
		<ul class="observations">
			{#each detection.observations as item (item)}<li>{item}</li>{/each}
		</ul>
	{/if}

	<section class="label-section">
		<h4><Tag size={16} /> 정확한 모델 확인</h4>

		<input bind:this={cameraInput} type="file" accept="image/*" capture="environment" class="sr-only" onchange={pick} tabindex="-1" />
		<input bind:this={galleryInput} type="file" accept="image/*" class="sr-only" onchange={pick} tabindex="-1" />

		{#if label.status === 'idle' || label.status === 'error'}
			{#if detection.requestedPhoto}<p class="muted guide">{detection.requestedPhoto}</p>{/if}
			{#if service?.external}
				<p class="consent">
					라벨 사진은 문자 인식을 위해 외부 AI 서비스({service.provider.split(':')[0]})로 전송됩니다. 케이스 전체 사진은
					전송되지 않으며, 개인정보가 담긴 스티커는 찍지 마세요.
				</p>
			{/if}
			{#if label.status === 'error'}
				<div class="notice notice-danger" role="alert"><CircleAlert size={18} />{label.error}</div>
			{/if}
			<div class="row">
				<button class="btn btn-primary" onclick={() => cameraInput.click()}><Camera size={18} /> 라벨 찍기</button>
				<button class="btn btn-secondary" onclick={() => galleryInput.click()}><ImagePlus size={18} /> 사진 고르기</button>
			</div>
		{:else if label.status === 'reading'}
			<p class="reading"><LoaderCircle size={18} class="spin" /> 라벨의 글자를 읽고 있어요…</p>
		{:else if reading}
			<dl class="result">
				<div><dt>제조사</dt><dd>{reading.manufacturer ?? '—'}</dd></div>
				<div><dt>모델명</dt><dd>{reading.model ?? '—'}</dd></div>
				{#if reading.partNumber}<div><dt>부품 번호</dt><dd class="mono">{reading.partNumber}</dd></div>{/if}
				<div><dt>판독</dt><dd>{legibilityText[reading.legibility]}</dd></div>
			</dl>

			{#if reading.visibleText.length}
				<div class="texts" aria-label="라벨에서 읽은 문자">
					{#each reading.visibleText as text, index (index)}<span class="mono">{text}</span>{/each}
				</div>
			{/if}

			{#if mismatch && reading.category}
				<div class="notice notice-warn"><CircleAlert size={18} />라벨에서 읽은 부품 종류({CATEGORY_NAMES[reading.category]})가 탐지 결과와 다릅니다.</div>
			{/if}
			{#each reading.notes as note (note)}<p class="muted note">{note}</p>{/each}
			{#if reading.demo}<p class="demo">데모 결과입니다. 실제 라벨을 읽으려면 서버에 API 키를 설정하세요.</p>{/if}

			{#if label.confirmed === undefined}
				<p class="ask">이 정보가 실제 부품과 맞나요?</p>
				<div class="row">
					<button class="btn btn-primary" onclick={() => onConfirm(true)}><Check size={18} /> 맞아요</button>
					<button class="btn btn-secondary" onclick={() => onConfirm(false)}><X size={18} /> 아니에요</button>
				</div>
			{:else}
				<div class="row">
					<button class="btn btn-ghost" onclick={() => cameraInput.click()}><RotateCcw size={16} /> 라벨 다시 찍기</button>
					{#if label.confirmed === false}<span class="muted small">더 가까이, 반사 없이 찍어보세요.</span>{/if}
				</div>
			{/if}
		{/if}
	</section>
</article>

<style>
	.panel {
		display: grid;
		gap: 16px;
		padding: 18px;
		border-top: 4px solid var(--c);
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 4px;
		background: var(--c);
	}

	h3 {
		font-size: 20px;
		flex: 1;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 9px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
	}

	.tag.ok {
		background: var(--ok-soft);
		color: var(--ok);
	}

	.tag.warn {
		background: var(--warn-soft);
		color: var(--warn);
	}

	.score {
		display: grid;
		gap: 6px;
	}

	.score-row {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
	}

	.bar {
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--c);
		border-radius: inherit;
	}

	.score small {
		font-size: 12px;
	}

	.observations {
		margin: 0;
		padding-left: 18px;
		font-size: 14px;
		color: var(--ink-2);
		display: grid;
		gap: 2px;
	}

	.label-section {
		display: grid;
		gap: 12px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}

	h4 {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 16px;
	}

	.guide {
		font-size: 14px;
	}

	.consent {
		font-size: 12.5px;
		color: var(--ink-3);
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.row .btn {
		flex: 1 1 140px;
	}

	.row .btn-ghost {
		flex: 0 0 auto;
	}

	.reading {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink-2);
	}

	.result {
		display: grid;
		gap: 6px;
		margin: 0;
	}

	.result div {
		display: grid;
		grid-template-columns: 76px 1fr;
		gap: 8px;
		font-size: 15px;
	}

	dt {
		color: var(--ink-3);
	}

	dd {
		margin: 0;
		font-weight: 650;
	}

	.mono {
		font-family: var(--mono);
		font-size: 13px;
	}

	.texts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.texts span {
		padding: 3px 8px;
		border-radius: 6px;
		background: var(--surface-2);
		color: var(--ink-2);
	}

	.note,
	.small {
		font-size: 13px;
	}

	.demo {
		font-size: 13px;
		color: var(--warn);
	}

	.ask {
		font-weight: 650;
	}
</style>
