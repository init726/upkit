<script lang="ts">
	import { ChevronRight, Lock, ScanLine, Tag } from '@lucide/svelte';

	let { demo, onStart }: { demo: boolean; onStart: () => void } = $props();

	const features = [
		{
			icon: ScanLine,
			title: '부품 위치를 윤곽선으로',
			body: '그래픽카드, 메모리, 쿨러 등 7가지 부품을 사진 위에 바로 표시합니다.'
		},
		{
			icon: Lock,
			title: '사진은 내 폰 안에서 분석',
			body: '부품 인식 AI가 브라우저에서 실행되어 케이스 사진이 서버로 올라가지 않습니다.'
		},
		{
			icon: Tag,
			title: '정확한 모델은 라벨로',
			body: '외형만으로 모델을 단정하지 않고, 라벨을 찍으면 적힌 문자를 읽어 확인합니다.'
		}
	];
</script>

<section class="intro">
	<div class="hero">
		<p class="eyebrow">See it. Swap it. Upgrade it.</p>
		<h1>케이스 안에 뭐가 어디 있는지,<br />사진 한 장으로 확인하세요.</h1>
		<p class="lead muted">
			조립 PC가 처음이어도 괜찮아요. 측면 패널을 열고 한 장만 찍으면 부품의 종류와 위치를 알려드립니다.
		</p>
		<button class="btn btn-primary start" onclick={onStart}>
			시작하기 <ChevronRight size={18} />
		</button>
		{#if demo}
			<p class="demo-note">지금은 학습된 모델 배포 전이라 데모 결과가 표시됩니다.</p>
		{/if}
	</div>

	<ul class="features">
		{#each features as feature (feature.title)}
			<li class="card">
				<span class="icon"><feature.icon size={20} /></span>
				<h3>{feature.title}</h3>
				<p class="muted">{feature.body}</p>
			</li>
		{/each}
	</ul>
</section>

<style>
	.intro {
		display: grid;
		gap: 40px;
		padding: 32px 0 48px;
	}

	.hero {
		display: grid;
		gap: 16px;
		justify-items: start;
		max-width: 640px;
	}

	h1 {
		font-size: clamp(30px, 6vw, 46px);
		font-weight: 800;
	}

	.lead {
		font-size: 17px;
	}

	.start {
		margin-top: 8px;
		min-width: 180px;
	}

	.demo-note {
		font-size: 13px;
		color: var(--warn);
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.features li {
		display: grid;
		gap: 8px;
		padding: 20px;
	}

	.features h3 {
		font-size: 17px;
	}

	.features p {
		font-size: 15px;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent);
	}
</style>
