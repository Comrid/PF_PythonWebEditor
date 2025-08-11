// Lazy-loaded Hand Gesture Recognizer for Webcam Widgets (MediaPipe Tasks)
// Exposes: enableHandGesture(widgetId), disableHandGesture(widgetId)

(function(){
    // Ensure globals exist (declared in util.js per project convention)
    if (typeof window.handGestureEnabledByWidget === 'undefined') {
        window.handGestureEnabledByWidget = new Map();
    }
    if (typeof window.handGestureHandsByWidget === 'undefined') {
        // reuse map name to minimize external changes; it will store recognizer instances
        window.handGestureHandsByWidget = new Map();
    }
    if (typeof window.handGestureRafByWidget === 'undefined') {
        window.handGestureRafByWidget = new Map();
    }
    if (typeof window.mediapipeTasksLoaded === 'undefined') {
        window.mediapipeTasksLoaded = false;
    }

    // Fallback connections when window.HAND_CONNECTIONS is not available
    const HAND_CONNECTIONS_FALLBACK = [
        // Thumb
        [0,1],[1,2],[2,3],[3,4],
        // Palm backbone
        [0,5],[5,9],[9,13],[13,17],[0,17],
        // Index
        [5,6],[6,7],[7,8],
        // Middle
        [9,10],[10,11],[11,12],
        // Ring
        [13,14],[14,15],[15,16],
        // Pinky
        [17,18],[18,19],[19,20]
    ];

    // CDN endpoints (align with sample)
    const TASKS_VERSION = '0.10.0';
    const TASKS_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
    const WASM_PATH = `${TASKS_BASE}/wasm`;
    const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

    function loadScript(src){
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load script: ' + src));
            document.head.appendChild(s);
        });
    }

    function loadModule(code){
        return new Promise((resolve, reject) => {
            const blob = new Blob([code], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const s = document.createElement('script');
            s.type = 'module';
            s.onload = () => { URL.revokeObjectURL(url); resolve(); };
            s.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('Failed to load module script')); };
            s.src = url;
            document.head.appendChild(s);
        });
    }

    async function ensureDrawingUtilsLoaded(){
        if (window.drawConnectors && window.drawLandmarks) return;
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
    }

    async function ensureGestureTasksLoaded(){
        if (window.mediapipeTasksLoaded && window.__GestureTasks) return;
        const moduleCode = `import { GestureRecognizer, FilesetResolver } from '${TASKS_BASE}';
            window.__GestureTasks = { GestureRecognizer, FilesetResolver };`;
        await loadModule(moduleCode);
        window.mediapipeTasksLoaded = true;
    }

    function getVideoAndCanvas(widgetId){
        const video = document.getElementById(`webcamVideo_${widgetId}`);
        const canvas = document.getElementById(`webcamOverlay_${widgetId}`);
        if (!video || !canvas) return { video: null, canvas: null, ctx: null };
        const ctx = canvas.getContext('2d');
        return { video, canvas, ctx };
    }

    function resizeCanvasToVideo(video, canvas){
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;
        if (!vw || !vh) return;
        if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
        }
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }

    function drawLabel(ctx, text){
        const padding = 8;
        ctx.save();
        ctx.font = '20px sans-serif';
        const metrics = ctx.measureText(text);
        const w = metrics.width + padding * 2;
        const h = 28;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(8, 8, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 8 + padding, 8 + h - 8);
        ctx.restore();
    }

    function formatGestureLabel(results){
        if (!results || !results.gestures || results.gestures.length === 0) return '-';
        const perHand = results.gestures.map((cands, idx) => {
            if (!cands || cands.length === 0) return null;
            const top = cands[0];
            const name = top.categoryName || top.CategoryName || 'unknown';
            const score = typeof top.score === 'number' ? top.score : (top.score || 0);
            return `Hand ${idx + 1}: ${name} (${(score * 100).toFixed(1)}%)`;
        }).filter(Boolean);
        return perHand.length > 0 ? perHand.join(' | ') : '-';
    }

    function formatGestureData(results){
        if (!results || !results.gestures || results.gestures.length === 0) {
            return {
                Hand1: {
                    isExist: false,
                    gesture: '-',
                    confidence: 0,
                    landmarks: []
                },
                Hand2: {
                    isExist: false,
                    gesture: '-',
                    confidence: 0,
                    landmarks: []
                }
            };
        }

        // 기본 구조 생성 (2개 손 모두)
        const gestureData = {
            Hand1: {
                isExist: false,
                gesture: '-',
                confidence: 0,
                landmarks: []
            },
            Hand2: {
                isExist: false,
                gesture: '-',
                confidence: 0,
                landmarks: []
            }
        };

        // 인식된 손 데이터 처리
        results.gestures.forEach((cands, idx) => {
            if (!cands || cands.length === 0) return;

            const top = cands[0];
            const name = top.categoryName || top.CategoryName || 'unknown';
            const score = typeof top.score === 'number' ? top.score : (top.score || 0);

            // Hand1 또는 Hand2에 데이터 할당
            const handKey = `Hand${idx + 1}`;
            if (gestureData[handKey]) {
                // landmark 추출 로직 수정
                let landmarks = [];

                landmarks = results.worldLandmarks[idx]

                gestureData[handKey] = {
                    isExist: true,
                    gesture: name,
                    confidence: score,
                    landmarks: landmarks
                };
            }
        });

        return gestureData;
    }

    async function setupRecognizer(widgetId){
        await ensureGestureTasksLoaded();
        await ensureDrawingUtilsLoaded();
        const { GestureRecognizer, FilesetResolver } = window.__GestureTasks || {};
        if (!GestureRecognizer || !FilesetResolver) return null;

        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU",
            },
            runningMode: 'VIDEO',
            numHands: 2, // 인식할 손 개수
          });
        return recognizer;
    }

    function drawLandmarksFromResults(ctx, results){
        if (!results || !results.landmarks) return;
        const connections = window.HAND_CONNECTIONS || HAND_CONNECTIONS_FALLBACK;
        for (const landmarks of results.landmarks) {
            if (window.drawConnectors) {
                window.drawConnectors(ctx, landmarks, connections, { color: '#00FF00', lineWidth: 5 });
            } else {
                // Fallback: manual lines
                ctx.save();
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 3;
                connections.forEach(([a, b]) => {
                    const pa = landmarks[a];
                    const pb = landmarks[b];
                    if (!pa || !pb) return;
                    ctx.beginPath();
                    ctx.moveTo(pa.x * ctx.canvas.width, pa.y * ctx.canvas.height);
                    ctx.lineTo(pb.x * ctx.canvas.width, pb.y * ctx.canvas.height);
                    ctx.stroke();
                });
                ctx.restore();
            }
            if (window.drawLandmarks) {
                window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
            } else {
                // Fallback: red dots
                ctx.save();
                ctx.fillStyle = '#FF0000';
                landmarks.forEach(p => {
                    ctx.beginPath();
                    ctx.arc(p.x * ctx.canvas.width, p.y * ctx.canvas.height, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.restore();
            }
        }
    }

    function startLoop(widgetId, recognizer){
        const { video, canvas, ctx } = getVideoAndCanvas(widgetId);
        if (!video || !canvas || !ctx) return;

        let lastVideoTime = -1;
        async function step(){
            if (window.handGestureEnabledByWidget.get(widgetId) !== true) return;
            if (video.readyState >= 2) {
                resizeCanvasToVideo(video, canvas);
                const nowMs = performance.now();
                if (lastVideoTime !== video.currentTime) {
                    lastVideoTime = video.currentTime;
                }
                const results = recognizer.recognizeForVideo(video, nowMs);
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawLandmarksFromResults(ctx, results);
                const label = formatGestureLabel(results);
                drawLabel(ctx, label);
                ctx.restore();

                const data = formatGestureData(results);

                // Save latest result and dispatch event
                try {
                    if (window.gestureLastResultByWidget && window.gestureLastResultByWidget.set) {
                        window.gestureLastResultByWidget.set(widgetId, { label, results });
                    }
                    const evt = new CustomEvent('hand_gesture_update', { detail: { widgetId, label } });
                    window.dispatchEvent(evt);
                    // Forward to backend via Socket.IO if available
                    if (window.socket && window.socket.connected) {
                        window.socket.emit('gesture_update', { data: data });
                    }
                } catch (_) { /* no-op */ }
            }
            const rafId = requestAnimationFrame(step);
            window.handGestureRafByWidget.set(widgetId, rafId);
        }
        const rafId = requestAnimationFrame(step);
        window.handGestureRafByWidget.set(widgetId, rafId);
    }

    async function enableHandGesture(widgetId){
        if (window.handGestureEnabledByWidget.get(widgetId) === true) return;
        const { video, canvas } = getVideoAndCanvas(widgetId);
        if (!video || !canvas) return;

        window.handGestureEnabledByWidget.set(widgetId, true);
        try {
            const recognizer = await setupRecognizer(widgetId);
            if (!recognizer) { window.handGestureEnabledByWidget.set(widgetId, false); return; }
            window.handGestureHandsByWidget.set(widgetId, recognizer);
            startLoop(widgetId, recognizer);
        } catch (e) {
            console.error('Failed to enable hand gesture:', e);
            window.handGestureEnabledByWidget.set(widgetId, false);
        }
    }

    function disableHandGesture(widgetId){
        if (window.handGestureEnabledByWidget.get(widgetId) !== true) return;
        window.handGestureEnabledByWidget.set(widgetId, false);
        const rafId = window.handGestureRafByWidget.get(widgetId);
        if (rafId) cancelAnimationFrame(rafId);
        window.handGestureRafByWidget.delete(widgetId);
        const recognizer = window.handGestureHandsByWidget.get(widgetId);
        if (recognizer && typeof recognizer.close === 'function') {
            try { recognizer.close(); } catch(_){}
        }
        window.handGestureHandsByWidget.delete(widgetId);

        // Clear overlay
        const { canvas, ctx } = getVideoAndCanvas(widgetId);
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // One-shot console logger for current recognition result of a widget
    function logGestureForWidget(widgetId){
        try {
            const recognizer = window.handGestureHandsByWidget && window.handGestureHandsByWidget.get ? window.handGestureHandsByWidget.get(widgetId) : null;
            const vc = getVideoAndCanvas(widgetId);
            const video = vc && vc.video ? vc.video : null;
            if (!recognizer) { console.warn('[hand_gesture] recognizer not found for', widgetId); return; }
            if (!video || video.readyState < 2) { console.warn('[hand_gesture] video not ready for', widgetId); return; }
            const results = recognizer.recognizeForVideo(video, performance.now());
            if (!results || !results.gestures || results.gestures.length === 0) {
                console.log('[hand_gesture] No gestures detected');
                return;
            }
            const summary = formatGestureLabel(results);
            const data = formatGestureData(results);
            // store and emit one-shot event as well
            try {
                if (window.gestureLastResultByWidget && window.gestureLastResultByWidget.set) {
                    window.gestureLastResultByWidget.set(widgetId, { label: summary, results });
                }
                const evt = new CustomEvent('hand_gesture_update', { detail: { widgetId, label: summary } });
                window.dispatchEvent(evt);
                // if (window.socket && window.socket.connected) {
                //     window.socket.emit('gesture_update', { label: data });
                // }
            } catch (_) { /* no-op */ }
            console.log('[hand_gesture]', summary);
        } catch (e) {
            console.error('[hand_gesture] log error:', e);
        }
    }

    // Accessor for latest result
    function getLatestGesture(widgetId){
        try {
            return window.gestureLastResultByWidget && window.gestureLastResultByWidget.get ? window.gestureLastResultByWidget.get(widgetId) : null;
        } catch (_) { return null; }
    }

    // Subscribe helper
    function subscribeHandGesture(handler){
        if (typeof handler !== 'function') return () => {};
        const listener = (e) => handler(e.detail);
        window.addEventListener('hand_gesture_update', listener);
        return () => window.removeEventListener('hand_gesture_update', listener);
    }

    // Expose to global
    window.enableHandGesture = enableHandGesture;
    window.disableHandGesture = disableHandGesture;
    window.logGestureForWidget = logGestureForWidget;
    window.getLatestGesture = getLatestGesture;
    window.subscribeHandGesture = subscribeHandGesture;
})();