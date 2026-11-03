<script lang="ts" module>
	export interface EngineBadge {
		state: 'loading' | 'demo' | 'on-device' | 'error';
		name?: string;
		backend?: 'webgpu' | 'wasm' | null;
	}
</script>

<script lang="ts">
	import { Cpu, FlaskConical, LoaderCircle, TriangleAlert } from '@lucide/svelte';

	let { engine, onHome }: { engine: EngineBadge; onHome: () => void } = $props();

	const label = $derived.by(() => {
		switch (engine.state) {
			case 'loading':
				return '분석기 확인 중';
			case 'demo':
				return '데모 분석기';
			case 'error':
				return '분석기 오류';
			case 'on-device':
				return engine.backend ? `기기 내 AI · ${engine.backend === 'webgpu' ? 'WebGPU' : 'WASM'}` : '기기 내 AI';
		}
	});
</script>

<header>
	<button class="logo" onclick={onHome} aria-label="Upkit 처음 화면으로">
		<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
			<rect width="32" height="32" rx="9" fill="currentColor" />
			<path d="M9 9h5v9a2 2 0 0 0 4 0V9h5v9a7 7 0 0 1-14 0z" fill="#ff6b35" />
		</svg>
		<span>Upkit</span>
	</button>

	<span class="badge {engine.state}" title={engine.name}>
		{#if engine.state === 'loading'}
			<LoaderCircle size={14} class="spin" />
		{:else if engine.state === 'demo'}
			<FlaskConical size={14} />
		{:else if engine.state === 'error'}
			<TriangleAlert size={14} />
		{:else}
			<Cpu size={14} />
		{/if}
		{label}
	</span>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		max-width: 1120px;
		margin: 0 auto;
		padding: 14px 16px;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 4px;
		border: 0;
		background: none;
		font-size: 19px;
		font-weight: 800;
		letter-spacing: -0.03em;
		cursor: pointer;
		color: var(--ink);
	}

	.logo svg {
		color: var(--ink);
	}

	.logo span {
		color: var(--ink);
	}

	@media (prefers-color-scheme: dark) {
		.logo svg {
			color: #1f2a25;
		}
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 11px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 650;
		white-space: nowrap;
		background: var(--surface-2);
		color: var(--ink-2);
	}

	.badge.demo {
		background: var(--warn-soft);
		color: var(--warn);
	}

	.badge.on-device {
		background: var(--ok-soft);
		color: var(--ok);
	}

	.badge.error {
		background: var(--danger-soft);
		color: var(--danger);
	}

	:global(.spin) {
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
