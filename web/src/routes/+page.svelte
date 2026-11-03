<script lang="ts">
	import { onMount, tick } from 'svelte';
	import AppHeader, { type EngineBadge } from '#lib/components/AppHeader.svelte';
	import StepAnalyzing from '#lib/components/StepAnalyzing.svelte';
	import StepCapture from '#lib/components/StepCapture.svelte';
	import StepIntro from '#lib/components/StepIntro.svelte';
	import StepResult from '#lib/components/StepResult.svelte';
	import StepSafety from '#lib/components/StepSafety.svelte';
	import type { LabelServiceStatus } from '#lib/label.ts';
	import type { AnalysisResult, ImageQuality } from '#lib/types.ts';
	import { createAnalyzer, type AnalyzerProgress, type PartAnalyzer } from '#lib/vision/analyzer.ts';
	import { loadPhoto, releasePhoto, type Photo } from '#lib/vision/image.ts';
	import { assessQuality } from '#lib/vision/quality.ts';

	type Step = 'intro' | 'safety' | 'capture' | 'analyzing' | 'result';

	let step = $state<Step>('intro');
	let analyzer = $state.raw<PartAnalyzer | null>(null);
	let engine = $state<EngineBadge>({ state: 'loading' });
	let service = $state.raw<LabelServiceStatus | null>(null);

	let photo = $state.raw<Photo | null>(null);
	let quality = $state.raw<ImageQuality | null>(null);
	let progress = $state.raw<AnalyzerProgress | null>(null);
	let result = $state.raw<AnalysisResult | null>(null);
	let error = $state('');

	const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

	onMount(() => {
		createAnalyzer()
			.then((created) => {
				analyzer = created;
				engine = { state: created.kind, name: created.name, backend: null };
			})
			.catch((e) => {
				engine = { state: 'error', name: message(e) };
				error = `분석기를 불러오지 못했습니다: ${message(e)}`;
			});

		fetch('/api/status')
			.then((r) => (r.ok ? r.json() : null))
			.then((status) => (service = status?.label ?? null))
			.catch(() => (service = null));

		return () => {
			analyzer?.dispose();
			releasePhoto(photo);
		};
	});

	async function go(next: Step) {
		step = next;
		await tick();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	/** 안전 확인을 하는 동안 모델을 미리 내려받아 첫 분석 대기 시간을 줄인다. */
	function prefetchModel() {
		if (!analyzer || analyzer.kind !== 'on-device') return;
		analyzer
			.prepare((p) => (progress = p))
			.then(() => {
				const backend = (analyzer as PartAnalyzer & { backend?: 'webgpu' | 'wasm' | null }).backend ?? null;
				engine = { ...engine, backend };
			})
			.catch((e) => {
				engine = { state: 'error', name: message(e) };
				error = `AI 모델을 불러오지 못했습니다: ${message(e)}`;
			});
	}

	async function selectPhoto(file: File) {
		error = '';
		try {
			const loaded = await loadPhoto(file);
			releasePhoto(photo);
			photo = loaded;
			quality = assessQuality(loaded.bitmap);
		} catch (e) {
			error = message(e);
		}
	}

	async function analyze() {
		if (!analyzer || !photo) return;
		error = '';
		progress = null;
		await go('analyzing');
		try {
			result = await analyzer.analyze(photo, (p) => (progress = p));
			const backend = result.engine.backend ?? null;
			if (backend) engine = { ...engine, backend };
			await go('result');
		} catch (e) {
			error = `분석하지 못했습니다: ${message(e)}`;
			await go('capture');
		}
	}

	function retake() {
		result = null;
		go('capture');
	}

	function home() {
		result = null;
		go('intro');
	}
</script>

<AppHeader {engine} onHome={home} />

<main>
	{#if step === 'intro'}
		<StepIntro demo={engine.state === 'demo'} onStart={() => go('safety')} />
	{:else if step === 'safety'}
		<StepSafety
			onBack={() => go('intro')}
			onDone={() => {
				prefetchModel();
				go('capture');
			}}
		/>
	{:else if step === 'capture'}
		<StepCapture
			{photo}
			{quality}
			{error}
			ready={analyzer !== null && engine.state !== 'error'}
			onSelect={selectPhoto}
			onAnalyze={analyze}
			onBack={() => go('safety')}
		/>
	{:else if step === 'analyzing' && photo}
		<StepAnalyzing {photo} {progress} demo={analyzer?.kind === 'demo'} />
	{:else if step === 'result' && photo && result}
		<StepResult {photo} {result} {service} onRetake={retake} />
	{/if}
</main>

<footer>
	<p>사진만으로 전기적 안전, 부품 고장, 완전 체결 여부는 판단할 수 없습니다. 파워서플라이 내부는 절대 열지 마세요.</p>
</footer>

<style>
	main {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 16px;
		min-height: calc(100dvh - 160px);
	}

	footer {
		max-width: 1120px;
		margin: 0 auto;
		padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		font-size: 12.5px;
		color: var(--ink-3);
	}
</style>
