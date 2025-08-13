// LLM (MediaPipe Tasks GenAI) helper
(function(){
    let genaiFileset = null;
    let llmInference = null;
    let loadingPromise = null;
    let lastError = null;
    const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm';
    // Default to Flask static served path
    let modelAssetPath = '/static/model/gemma2-2b-it-gpu-int8.bin';
    let triedStaticFallback = false;
  
    function snapshot(){
      return { loaded: !!llmInference, loading: !!loadingPromise && !llmInference, error: lastError };
    }
  
    function dispatchStatus(){
      const detail = snapshot();
      try { window.__llmStatus = detail; } catch(_){}
      const ev = new CustomEvent('llm_status_changed', { detail });
      try { window.dispatchEvent(ev); } catch (_) {}
    }
  
    function toStaticFallbackPath(path){
      try {
        const name = String(path).split('/').pop();
        return '/static/model/' + name;
      } catch(_) { return '/static/model/gemma2-2b-it-gpu-int8.bin'; }
    }
  
    async function ensureLoaded(){
      if (llmInference) return llmInference;
      if (loadingPromise) return loadingPromise;
      lastError = null;
      dispatchStatus();
      loadingPromise = (async () => {
        try {
          const { FilesetResolver, LlmInference } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai');
          genaiFileset = await FilesetResolver.forGenAiTasks(WASM_BASE);
          llmInference = await LlmInference.createFromOptions(genaiFileset, {
            baseOptions: { modelAssetPath },
          });
          return llmInference;
        } catch (e) {
          // One-time fallback: if path is relative or not under /static/, switch to /static/model/<name>
          if (!triedStaticFallback && typeof modelAssetPath === 'string' && !modelAssetPath.startsWith('/static/')) {
            triedStaticFallback = true;
            modelAssetPath = toStaticFallbackPath(modelAssetPath);
            return ensureLoaded();
          }
          lastError = e instanceof Error ? e.message : String(e);
          throw e;
        } finally {
          const success = !!llmInference;
          const tmpErr = lastError;
          loadingPromise = null;
          if (!success) { /* keep llmInference as null on failure */ }
          dispatchStatus();
          if (tmpErr) console.error('LLM load failed:', tmpErr, 'path:', modelAssetPath);
        }
      })();
      return loadingPromise;
    }
  
    async function loadLLM(){
      try {
        const r = await ensureLoaded();
        return r;
      } catch (e) {
        throw e;
      }
    }
  
    async function askLLM(promptText, onPartial){
      if (!promptText || typeof promptText !== 'string') return;
      const llm = await ensureLoaded();
      return new Promise((resolve, reject) => {
        try {
          llm.generateResponse(promptText, (partial, complete) => {
            try { if (typeof onPartial === 'function') onPartial(partial, complete); } catch(_){}
            if (complete) resolve();
          });
        } catch (e) {
          reject(e);
        }
      });
    }
  
    function setLlmModelPath(path){
      if (path) {
        modelAssetPath = path;
        lastError = null;
        triedStaticFallback = false;
      }
    }
    function isLlmLoaded(){ return !!llmInference; }
    function getLlmStatus(){ try { return window.__llmStatus || snapshot(); } catch(_) { return snapshot(); } }
  
    window.askLLM = askLLM;
    window.setLlmModelPath = setLlmModelPath;
    window.isLlmLoaded = isLlmLoaded;
    window.getLlmStatus = getLlmStatus;
    window.loadLLM = loadLLM;
    dispatchStatus();
  
    // Auto-start model loading on script load
    try { loadLLM().catch(()=>{}); } catch(_) {}
  })();
  