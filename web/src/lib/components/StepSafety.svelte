<script lang="ts">
	import { ArrowLeft, Check, ChevronRight, ShieldCheck } from '@lucide/svelte';

	let { onBack, onDone }: { onBack: () => void; onDone: () => void } = $props();

	const items = [
		{ title: 'PC를 완전히 종료하고 전원 케이블을 뽑았어요', hint: '파워 뒷면 스위치도 O(꺼짐)로 돌려주세요.' },
		{ title: '측면 패널을 열었어요', hint: '강화유리 패널은 미끄러지지 않는 곳에 눕혀 두세요.' },
		{ title: '파워서플라이 내부는 열지 않을게요', hint: '파워 안에는 전원을 뽑아도 전기가 남아 있을 수 있습니다.' }
	];
	let checked = $state(items.map(() => false));
	const allChecked = $derived(checked.every(Boolean));
</script>

<section class="safety">
	<button class="btn btn-ghost back" onclick={onBack}><ArrowLeft size={18} /> 처음으로</button>

	<div class="head">
		<span class="shield"><ShieldCheck size={26} /></span>
		<h2>촬영 전에 안전부터 확인해요</h2>
		<p class="muted">세 가지를 모두 확인해야 다음 단계로 넘어갈 수 있어요.</p>
	</div>

	<ul>
		{#each items as item, index (item.title)}
			<li>
				<label class="card" class:on={checked[index]}>
					<input type="checkbox" class="sr-only" bind:checked={checked[index]} />
					<span class="box" aria-hidden="true">{#if checked[index]}<Check size={16} strokeWidth={3} />{/if}</span>
					<span class="text">
						<strong>{item.title}</strong>
						<small class="muted">{item.hint}</small>
					</span>
				</label>
			</li>
		{/each}
	</ul>

	<p class="tip muted">작업 전 케이스 금속 부분을 한 번 만져 몸의 정전기를 빼주세요.</p>

	<button class="btn btn-primary btn-block" disabled={!allChecked} onclick={onDone}>
		촬영하러 가기 <ChevronRight size={18} />
	</button>
</section>

<style>
	.safety {
		display: grid;
		gap: 20px;
		max-width: 560px;
		margin: 0 auto;
		padding: 8px 0 48px;
	}

	.back {
		justify-self: start;
		margin-left: -12px;
	}

	.head {
		display: grid;
		gap: 8px;
	}

	.shield {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--ok-soft);
		color: var(--ok);
		margin-bottom: 4px;
	}

	h2 {
		font-size: 26px;
	}

	ul {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	label {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		padding: 16px;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	label:has(:focus-visible) {
		outline: 3px solid color-mix(in srgb, var(--accent) 70%, transparent);
		outline-offset: 2px;
	}

	label.on {
		border-color: var(--ok);
	}

	.box {
		display: grid;
		place-items: center;
		flex: none;
		width: 26px;
		height: 26px;
		border-radius: 8px;
		border: 2px solid var(--line);
		color: #fff;
	}

	label.on .box {
		background: var(--ok);
		border-color: var(--ok);
	}

	.text {
		display: grid;
		gap: 2px;
	}

	.text small {
		font-size: 14px;
	}

	.tip {
		font-size: 14px;
	}
</style>
