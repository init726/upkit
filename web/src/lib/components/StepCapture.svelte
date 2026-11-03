<script lang="ts">
	import { ArrowLeft, Camera, ImagePlus, LoaderCircle, ScanLine, TriangleAlert } from '@lucide/svelte';
	import type { ImageQuality } from '#lib/types.ts';
	import type { Photo } from '#lib/vision/image.ts';
	import { QUALITY_MESSAGES } from '#lib/vision/quality.ts';

	let {
		photo,
		quality,
		error,
		ready,
		onSelect,
		onAnalyze,
		onBack
	}: {
		photo: Photo | null;
		quality: ImageQuality | null;
		error: string;
		ready: boolean;
		onSelect: (file: File) => void;
		onAnalyze: () => void;
		onBack: () => void;
	} = $props();

	let cameraInput: HTMLInputElement;
	let galleryInput: HTMLInputElement;

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) onSelect(file);
	}

	const tips = [
		'측면 패널을 열고, 메인보드 면 전체가 한 화면에 들어오게',
		'케이스 정면이 아니라 옆에서, 부품 면과 평행하게',
		'RGB 조명은 끄고 방 조명이나 손전등으로 밝게',
		'케이블 정리 공간(뒷면)이 아니라 부품이 있는 면'
	];
</script>

<section class="capture">
	<button class="btn btn-ghost back" onclick={onBack}><ArrowLeft size={18} /> 안전 확인</button>

	<div class="head">
		<h2>PC 내부를 찍어주세요</h2>
		<p class="muted">사진은 이 기기 안에서만 분석됩니다.</p>
	</div>

	<input bind:this={cameraInput} type="file" accept="image/*" capture="environment" class="sr-only" onchange={pick} tabindex="-1" />
	<input bind:this={galleryInput} type="file" accept="image/*" class="sr-only" onchange={pick} tabindex="-1" />

	{#if photo}
		<figure class="preview card">
			<img src={photo.url} alt="선택한 PC 내부 사진" style="aspect-ratio: {photo.width} / {photo.height}" />
			<figcaption class="muted">{photo.width} × {photo.height}</figcaption>
		</figure>

		{#if quality && quality.issues.length}
			<div class="notice notice-warn" role="status">
				<TriangleAlert size={18} />
				<div>
					<strong>다시 찍으면 더 정확해져요</strong>
					<ul>
						{#each quality.issues as issue (issue)}<li>{QUALITY_MESSAGES[issue]}</li>{/each}
					</ul>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="notice notice-danger" role="alert"><TriangleAlert size={18} />{error}</div>
		{/if}

		<div class="actions">
			<button class="btn btn-primary" onclick={onAnalyze} disabled={!ready}>
				{#if ready}<ScanLine size={18} />{quality?.issues.length ? '그래도 분석하기' : '부품 분석하기'}
				{:else}<LoaderCircle size={18} class="spin" />분석기 준비 중{/if}
			</button>
			<button class="btn btn-secondary" onclick={() => cameraInput.click()}><Camera size={18} /> 다시 찍기</button>
			<button class="btn btn-ghost" onclick={() => galleryInput.click()}><ImagePlus size={18} /> 다른 사진</button>
		</div>
	{:else}
		<div class="pickers">
			<button class="picker card primary" onclick={() => cameraInput.click()}>
				<Camera size={28} />
				<strong>카메라로 찍기</strong>
				<small>휴대폰 후면 카메라</small>
			</button>
			<button class="picker card" onclick={() => galleryInput.click()}>
				<ImagePlus size={28} />
				<strong>사진 고르기</strong>
				<small>앨범이나 파일에서</small>
			</button>
		</div>

		{#if error}
			<div class="notice notice-danger" role="alert"><TriangleAlert size={18} />{error}</div>
		{/if}

		<div class="tips card">
			<strong>잘 나오는 사진 찍는 법</strong>
			<ol>
				{#each tips as tip (tip)}<li>{tip}</li>{/each}
			</ol>
		</div>
	{/if}
</section>

<style>
	.capture {
		display: grid;
		gap: 18px;
		max-width: 640px;
		margin: 0 auto;
		padding: 8px 0 48px;
	}

	.back {
		justify-self: start;
		margin-left: -12px;
	}

	.head {
		display: grid;
		gap: 6px;
	}

	h2 {
		font-size: 26px;
	}

	.pickers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.picker {
		display: grid;
		justify-items: center;
		gap: 6px;
		padding: 28px 12px;
		cursor: pointer;
		color: var(--ink);
		transition: border-color 0.15s;
	}

	.picker:hover {
		border-color: var(--ink-3);
	}

	.picker.primary {
		border-color: var(--accent);
		color: var(--accent);
	}

	.picker strong {
		color: var(--ink);
	}

	.picker small {
		color: var(--ink-3);
		font-size: 13px;
	}

	.tips {
		padding: 18px 20px;
	}

	.tips ol {
		margin: 8px 0 0;
		padding-left: 20px;
		color: var(--ink-2);
		font-size: 15px;
		display: grid;
		gap: 4px;
	}

	.preview {
		margin: 0;
		padding: 8px;
		display: grid;
		gap: 6px;
	}

	.preview img {
		width: 100%;
		max-height: 60vh;
		object-fit: contain;
		border-radius: 12px;
		background: var(--surface-2);
	}

	.preview figcaption {
		font-size: 12px;
		text-align: right;
		padding-right: 4px;
	}

	.notice ul {
		margin: 4px 0 0;
		padding-left: 18px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.actions .btn-primary {
		flex: 1 1 100%;
	}

	@media (min-width: 560px) {
		.actions .btn-primary {
			flex: 1 1 auto;
		}
	}
</style>
