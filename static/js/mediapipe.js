import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";


let gestureRecognizer = undefined;
let runningMode = "IMAGE";
let lastVideoTime = -1;


async function createRecognizer() {
    console.log('createRecognizer');
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU",
        },
        runningMode,
        numHands: 2,
    });
}

createRecognizer().catch((e) => console.error(e));





function enableCam() {
  if (!gestureRecognizer) return;
  if (!hasGetUserMedia()) {
    alert("getUserMedia() is not supported by your browser");
    return;
  }
  if (!video || !canvasEl) return;

  webcamRunning = !webcamRunning;
  if (webcamButton) webcamButton.textContent = webcamRunning ? "DISABLE WEBCAM" : "ENABLE WEBCAM";

  if (webcamRunning) {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    });
  } else {
    const ms = /** @type {MediaStream|null} */ (video.srcObject);
    if (ms) ms.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    if (gestureOutput) gestureOutput.textContent = "-";
    if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
}






async function predictWebcam() {
    if (!video || !canvasEl || !gestureRecognizer) return;

    // sync canvas size
    canvasEl.style.width = `${video.videoWidth}px`;
    canvasEl.style.height = `${video.videoHeight}px`;
    canvasEl.width = video.videoWidth;
    canvasEl.height = video.videoHeight;
    const c = canvasEl.getContext("2d");
    if (!c) return;

    if (runningMode === "IMAGE") {
      runningMode = "VIDEO";
      await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    const nowMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
    }
    const results = gestureRecognizer.recognizeForVideo(video, nowMs);

    c.save();
    c.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (results) {
      // draw landmarks
      if (results.landmarks) {
        for (const landmarks of results.landmarks) {
          drawConnectors(c, landmarks, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
          drawLandmarks(c, landmarks, { color: "#FF0000", lineWidth: 2 });
        }
      }

      // show gesture labels
      let labelText = "-";
      if (results.gestures && results.gestures.length > 0) {
        const perHand = results.gestures.map((cands, idx) => {
          if (!cands || cands.length === 0) return null;
          const top = cands[0];
          const name = top.categoryName || top.CategoryName || "unknown";
          const score = typeof top.score === "number" ? top.score : (top.score || 0);
          return `Hand ${idx + 1}: ${name} (${(score * 100).toFixed(1)}%)`;
        }).filter(Boolean);
        if (perHand.length > 0) labelText = perHand.join(" | ");
      }
      if (gestureOutput) gestureOutput.textContent = labelText;
    }

    c.restore();

    if (webcamRunning) requestAnimationFrame(predictWebcam);
  }