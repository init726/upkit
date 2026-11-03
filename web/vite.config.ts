import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter() })],
	resolve: {
		// onnxruntime-web의 "wasm 미포함" 빌드를 사용한다. 28MB 런타임 wasm을 번들에 넣지 않고
		// worker.ts의 ort.env.wasm.wasmPaths(CDN)에서 런타임에 받는다.
		conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions]
	},
	// onnxruntime-web은 자체적으로 wasm을 로드하므로 사전 번들링에서 제외한다.
	optimizeDeps: { exclude: ['onnxruntime-web'] },
	worker: { format: 'es' }
});
