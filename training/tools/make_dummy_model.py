"""웹 런타임 테스트용 가짜 ONNX 모델을 만든다.

DETR-seg 출력 형식(boxes / logits / masks)을 흉내 내며, 입력 사진과 무관하게
그래픽카드·메모리·CPU 쿨러(+중복·배경 쿼리)를 고정으로 출력한다.
학습된 모델 없이 web/의 기기 내 분석 경로(다운로드 → WebGPU/WASM 실행 → 디코딩
→ 윤곽선 → 규칙)를 확인할 때 사용한다.

    pip install onnx numpy
    python training/tools/make_dummy_model.py web/static/models/upkit-seg

테스트가 끝나면 web/static/models/upkit-seg/의 model.onnx, model.json을 지운다.
"""
import json, sys
import numpy as np, onnx
from onnx import helper, TensorProto, numpy_helper

out = sys.argv[1]
S, Q, C, M = 128, 5, 9, 32
boxes = np.array([[0.48, 0.60, 0.62, 0.20],   # gpu
                  [0.47, 0.61, 0.60, 0.21],   # gpu dup
                  [0.70, 0.30, 0.08, 0.30],   # memory
                  [0.45, 0.28, 0.22, 0.26],   # cooler (low score -> confirm)
                  [0.10, 0.10, 0.05, 0.05]], np.float32)[None]
logits = np.full((1, Q, C), -6, np.float32)
logits[0, 0, 2] = 3.0; logits[0, 1, 2] = 1.2; logits[0, 2, 3] = 2.0; logits[0, 3, 5] = 0.1; logits[0, 4, 0] = 8
masks = np.full((1, Q, M, M), -4, np.float32)
yy, xx = np.mgrid[0:M, 0:M] + 0.5
for q in range(Q):
    cx, cy, w, h = boxes[0, q]
    inside = (np.abs(xx / M - cx) < w / 2 * 0.95) & (np.abs(yy / M - cy) < h / 2 * 0.9)
    if q == 3:  # 쿨러는 원형
        inside = ((xx / M - cx) ** 2 + (yy / M - cy) ** 2) < (w / 2) ** 2
    masks[0, q][inside] = 4

inp = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, S, S])
nodes, inits, outs = [], [], []
nodes.append(helper.make_node('ReduceMean', ['input'], ['mean'], keepdims=0))
inits.append(numpy_helper.from_array(np.array(0, np.float32), 'zero'))
nodes.append(helper.make_node('Mul', ['mean', 'zero'], ['z']))
for name, arr in [('dets', boxes), ('labels', logits), ('masks', masks)]:
    inits.append(numpy_helper.from_array(arr, name + '_c'))
    nodes.append(helper.make_node('Add', [name + '_c', 'z'], [name]))
    outs.append(helper.make_tensor_value_info(name, TensorProto.FLOAT, list(arr.shape)))
graph = helper.make_graph(nodes, 'dummy-detr-seg', [inp], outs, inits)
model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 13)])
model.ir_version = 8
onnx.checker.check_model(model)
onnx.save(model, f'{out}/model.onnx')
json.dump({
    'name': 'upkit-seg-dummy', 'version': '0.0.0-test', 'architecture': 'detr-seg', 'file': 'model.onnx',
    'input': {'size': S, 'mean': [0.485, 0.456, 0.406], 'std': [0.229, 0.224, 0.225]},
    'classes': [None, 'motherboard', 'gpu', 'memory', 'storage', 'cpu_cooler', 'power_supply', 'case_fan', 'unknown'],
    'outputs': {'boxes': 'dets', 'logits': 'labels', 'masks': 'masks'},
    'thresholds': {'minScore': 0.3, 'unknownBelow': 0.4, 'confirmBelow': 0.6},
    'maxDetections': 12
}, open(f'{out}/model.json', 'w'), indent=2)
print('ok')
