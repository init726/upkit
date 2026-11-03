<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Upkit — 사진 한 장으로 PC 부품 확인</title>
	<meta name="description" content="PC 케이스 내부 사진으로 부품의 종류와 위치를 확인하고, 라벨로 정확한 모델을 찾습니다." />
	<link
		rel="stylesheet"
		href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
	/>
</svelte:head>

{@render children()}
