import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  Eraser,
  FileImage,
  History,
  KeyRound,
  Link,
  LoaderCircle,
  LogIn,
  Play,
  PlugZap,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];
const GEMINI_THINKING = ["minimal", "low", "medium", "high"];
const MAX_EDGE = 2048;
const MAX_BYTES = 20 * 1024 * 1024;

const providerLabels = {
  openai: "OpenAI OAuth",
  gemini: "Gemini"
};

const modelLabels = {
  "gpt-5.5": "GPT-5.5",
  "gpt-5.4": "GPT-5.4",
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite"
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isLikelyUrl(text) {
  try {
    const url = new URL(text.trim());
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function asErrorMessage(error) {
  return error?.message || String(error || "Unknown error");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || response.statusText);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function prepareImageFile(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("jpg/png/webp 이미지만 지원합니다.");
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const maxEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = maxEdge > MAX_EDGE ? MAX_EDGE / maxEdge : 1;
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  let dataUrl = originalDataUrl;
  let sizeBytes = file.size;
  let optimized = false;

  if (scale < 1 || file.size > MAX_BYTES * 0.65) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { alpha: file.type !== "image/jpeg" });
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const blob = await canvasToBlob(canvas, file.type, file.type === "image/png" ? undefined : 0.85);
    if (blob && (scale < 1 || blob.size < file.size)) {
      dataUrl = await readFileAsDataUrl(blob);
      sizeBytes = blob.size;
      optimized = true;
    }
  }

  if (sizeBytes > MAX_BYTES) {
    throw new Error("이미지 용량이 20MB를 초과했습니다.");
  }

  return {
    dataUrl,
    name: file.name || "image",
    mimeType: file.type,
    sizeBytes,
    width: targetWidth,
    height: targetHeight,
    optimized,
    source: "file"
  };
}

function ControlButton({ icon: Icon, children, className = "", busy = false, ...props }) {
  return (
    <button className={`control-button ${className}`} {...props}>
      {busy ? <LoaderCircle className="spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

function Segment({ options, value, onChange, disabled = false }) {
  return (
    <div className="segment">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "active" : ""}
          onClick={() => onChange(option)}
          disabled={disabled}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [provider, setProvider] = useState("openai");
  const [openaiModel, setOpenaiModel] = useState("gpt-5.5");
  const [geminiModel, setGeminiModel] = useState("gemini-3.5-flash");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [thinkingLevel, setThinkingLevel] = useState("medium");
  const [keyword, setKeyword] = useState("");
  const [image, setImage] = useState(null);
  const [urlText, setUrlText] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [urlBusy, setUrlBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastAppliedUrlRef = useRef("");

  const currentModel = provider === "openai" ? openaiModel : geminiModel;
  const imageReady = Boolean(image?.dataUrl);
  const canGenerate = imageReady && !busy && (provider !== "gemini" || status?.gemini?.keySaved);

  const modelOptions = useMemo(() => (provider === "openai" ? OPENAI_MODELS : GEMINI_MODELS), [provider]);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api("/api/status");
      setStatus(data);
    } catch (error) {
      setMessage(asErrorMessage(error));
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const data = await api("/api/history");
      setHistory(data.history || []);
    } catch (error) {
      setMessage(asErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshHistory();
    const timer = setInterval(refreshStatus, 8000);
    return () => clearInterval(timer);
  }, [refreshHistory, refreshStatus]);

  const setPreparedImage = useCallback((nextImage) => {
    setImage(nextImage);
    setResult("");
    setMessage(`${nextImage.name} 불러옴 · ${formatBytes(nextImage.sizeBytes)}`);
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      try {
        setMessage("이미지 준비 중...");
        const prepared = await prepareImageFile(file);
        setPreparedImage(prepared);
      } catch (error) {
        setMessage(asErrorMessage(error));
      }
    },
    [setPreparedImage]
  );

  const loadUrl = useCallback(
    async (url, auto = false) => {
      const cleaned = url.trim();
      if (!cleaned || !isLikelyUrl(cleaned)) {
        if (!auto) setMessage("유효한 이미지 URL을 입력하세요.");
        return;
      }
      if (auto && cleaned === lastAppliedUrlRef.current) return;
      lastAppliedUrlRef.current = cleaned;
      setUrlBusy(true);
      try {
        const data = await api("/api/image-url", {
          method: "POST",
          body: JSON.stringify({ url: cleaned })
        });
        setPreparedImage({
          dataUrl: data.dataUrl,
          name: new URL(cleaned).pathname.split("/").filter(Boolean).pop() || "remote-image",
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          source: "url",
          optimized: false
        });
      } catch (error) {
        setMessage(asErrorMessage(error));
      } finally {
        setUrlBusy(false);
      }
    },
    [setPreparedImage]
  );

  useEffect(() => {
    if (!urlText.trim() || !isLikelyUrl(urlText)) return;
    const timer = setTimeout(() => loadUrl(urlText, true), 900);
    return () => clearTimeout(timer);
  }, [loadUrl, urlText]);

  const connectOpenAI = useCallback(async () => {
    setConnectBusy(true);
    setMessage("OpenAI OAuth 확인 중...");
    try {
      const data = await api("/api/openai/connect", {
        method: "POST",
        body: JSON.stringify({ login: true })
      });
      if (data.connected) {
        setMessage("OpenAI OAuth 연결됨");
      } else {
        setMessage(data.message || "OpenAI 로그인 시작됨");
      }
      await refreshStatus();
    } catch (error) {
      setMessage(asErrorMessage(error));
    } finally {
      setConnectBusy(false);
    }
  }, [refreshStatus]);

  const saveGeminiKey = useCallback(async () => {
    if (!keyInput.trim()) {
      setMessage("Gemini API 키를 입력하세요.");
      return;
    }
    setConnectBusy(true);
    try {
      await api("/api/gemini/key", {
        method: "POST",
        body: JSON.stringify({ apiKey: keyInput.trim() })
      });
      setKeyInput("");
      setKeyPanelOpen(false);
      setMessage("Gemini API 키 저장됨");
      await refreshStatus();
    } catch (error) {
      setMessage(asErrorMessage(error));
    } finally {
      setConnectBusy(false);
    }
  }, [keyInput, refreshStatus]);

  const deleteGeminiKey = useCallback(async () => {
    setConnectBusy(true);
    try {
      await api("/api/gemini/key", { method: "DELETE" });
      setMessage("Gemini API 키 삭제됨");
      await refreshStatus();
    } catch (error) {
      setMessage(asErrorMessage(error));
    } finally {
      setConnectBusy(false);
    }
  }, [refreshStatus]);

  const generate = useCallback(async () => {
    if (!imageReady || busy) return;
    setBusy(true);
    setResult("");
    setMessage("프롬프트 생성 중...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await api("/api/generate", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          provider,
          model: currentModel,
          reasoningEffort,
          thinkingLevel,
          keyword,
          image: {
            dataUrl: image.dataUrl,
            name: image.name,
            source: image.source,
            sizeBytes: image.sizeBytes
          }
        })
      });
      setResult(data.result.text);
      setMessage(`완료 · ${(data.result.durationMs / 1000).toFixed(1)}초`);
      await refreshHistory();
      await refreshStatus();
    } catch (error) {
      if (error.name === "AbortError") {
        setMessage("중단됨");
      } else {
        setMessage(asErrorMessage(error));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [
    busy,
    currentModel,
    image,
    imageReady,
    keyword,
    provider,
    reasoningEffort,
    refreshHistory,
    refreshStatus,
    thinkingLevel
  ]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setMessage("중단 중...");
  }, []);

  const retry = useCallback(() => {
    if (imageReady && !busy) {
      generate();
    }
  }, [busy, generate, imageReady]);

  const copyResult = useCallback(async () => {
    if (!result.trim()) return;
    await navigator.clipboard.writeText(result);
    setMessage("복사됨");
  }, [result]);

  const clearResult = useCallback(() => {
    setResult("");
    setMessage("결과 지움");
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await api("/api/history", { method: "DELETE" });
      setHistory([]);
      setMessage("기록 지움");
    } catch (error) {
      setMessage(asErrorMessage(error));
    }
  }, []);

  const applyHistory = useCallback((entry) => {
    setResult(entry.text);
    setProvider(entry.provider);
    if (entry.provider === "openai") setOpenaiModel(entry.model);
    if (entry.provider === "gemini") setGeminiModel(entry.model);
    setKeyword(entry.keyword || "");
    setMessage(`기록 불러옴 · ${entry.model}`);
  }, []);

  useEffect(() => {
    function isTypingTarget(target) {
      const tag = target?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || target?.isContentEditable;
    }

    async function onPaste(event) {
      if (isTypingTarget(event.target) && event.target.name !== "urlText") {
        return;
      }
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (imageItem) {
        event.preventDefault();
        await handleFile(imageItem.getAsFile());
        return;
      }
      const text = event.clipboardData?.getData("text") || "";
      if (isLikelyUrl(text)) {
        event.preventDefault();
        setUrlText(text.trim());
        await loadUrl(text.trim());
      }
    }

    function onKeyDown(event) {
      if (event.key === "F1") {
        event.preventDefault();
        generate();
      } else if (event.key === "F5") {
        event.preventDefault();
        retry();
      } else if (event.key === "Escape" && busy) {
        event.preventDefault();
        cancel();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && !isTypingTarget(event.target)) {
        const selection = window.getSelection()?.toString();
        if (!selection && result.trim()) {
          event.preventDefault();
          copyResult();
        }
      }
    }

    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, cancel, copyResult, generate, handleFile, loadUrl, result, retry]);

  function onDrop(event) {
    event.preventDefault();
    setDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
      return;
    }
    const text = event.dataTransfer.getData("text");
    if (isLikelyUrl(text)) {
      setUrlText(text.trim());
      loadUrl(text.trim());
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>GPI 2.0</strong>
            <span>Precision Studio</span>
          </div>
        </div>

        <div className="auth-actions" aria-label="인증 액션">
          <ControlButton
            icon={LogIn}
            onClick={connectOpenAI}
            busy={connectBusy}
            title="ChatGPT OAuth 로그인"
            className={`auth-button ${status?.openai?.running ? "connected" : ""}`}
          >
            chat gpt oauth 로그인
          </ControlButton>
          <ControlButton
            icon={KeyRound}
            onClick={() => setKeyPanelOpen((open) => !open)}
            title="Gemini API key 입력"
            className={`auth-button ${status?.gemini?.keySaved ? "connected" : ""}`}
          >
            gemini api key 입력
          </ControlButton>
        </div>

        <div className="status-strip">
          <span className={`status-pill ${status?.openai?.running ? "ok" : "warn"}`}>
            <PlugZap size={14} />
            ChatGPT OAuth {status?.openai?.running ? "연결됨" : "미연결"}
          </span>
          <span className={`status-pill ${status?.gemini?.keySaved ? "ok" : "muted"}`}>
            <KeyRound size={14} />
            Gemini {status?.gemini?.keySaved ? "키 저장됨" : "키 없음"}
          </span>
          <span className="status-message">{message === "Ready" ? "준비됨" : message}</span>
        </div>
      </header>

      {keyPanelOpen ? (
        <section className="key-panel">
          <div>
            <strong>Gemini API Key</strong>
            <span>{status?.gemini?.keySaved ? "로컬 키가 저장되어 있습니다." : ".gpi/local.json에만 저장됩니다."}</span>
          </div>
          <input
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="Gemini API 키 붙여넣기"
            type="password"
          />
          <ControlButton icon={CheckCircle2} onClick={saveGeminiKey} busy={connectBusy}>
            저장
          </ControlButton>
          <ControlButton icon={Trash2} onClick={deleteGeminiKey} disabled={!status?.gemini?.keySaved}>
            삭제
          </ControlButton>
        </section>
      ) : null}

      <main className="workspace">
        <section className="left-stack">
          <div
            className={`drop-zone ${dropActive ? "active" : ""} ${imageReady ? "has-image" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={onDrop}
          >
            {imageReady ? (
              <>
                <img src={image.dataUrl} alt="" />
                <div className="image-meta">
                  <strong>{image.name}</strong>
                  <span>
                    {formatBytes(image.sizeBytes)}
                    {image.optimized ? " · optimized" : ""}
                  </span>
                </div>
                <button className="remove-image" onClick={() => setImage(null)} title="Remove image">
                  <X size={16} />
                </button>
              </>
            ) : (
              <div className="empty-drop">
                <FileImage size={34} />
                <strong>이미지 놓기</strong>
                <span>jpg · png · webp</span>
              </div>
            )}
          </div>

          <div className="intake-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <ControlButton icon={Upload} onClick={() => fileInputRef.current?.click()}>
              파일
            </ControlButton>
            <ControlButton icon={Clipboard} onClick={() => navigator.clipboard.readText().then((text) => loadUrl(text)).catch(() => setMessage("클립보드 이미지는 Ctrl+V로 붙여넣으세요."))}>
              URL 붙여넣기
            </ControlButton>
          </div>

          <label className="field-label" htmlFor="urlText">이미지 URL</label>
          <div className="url-row">
            <Link size={17} />
            <input
              id="urlText"
              name="urlText"
              value={urlText}
              onChange={(event) => setUrlText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  loadUrl(urlText);
                }
              }}
              placeholder="https://..."
            />
            <button onClick={() => loadUrl(urlText)} disabled={urlBusy}>
              {urlBusy ? <LoaderCircle className="spin" size={16} /> : "불러오기"}
            </button>
          </div>

          <section className="settings-panel">
            <div className="panel-heading">
              <span>제공자</span>
              <strong>{providerLabels[provider]}</strong>
            </div>
            <Segment options={["openai", "gemini"]} value={provider} onChange={setProvider} disabled={busy} />

            <label className="field-label" htmlFor="modelSelect">모델</label>
            <select
              id="modelSelect"
              value={currentModel}
              onChange={(event) => {
                provider === "openai" ? setOpenaiModel(event.target.value) : setGeminiModel(event.target.value);
                if (event.target.value === "gemini-3.1-flash-lite") setThinkingLevel("minimal");
                if (event.target.value === "gemini-3.5-flash") setThinkingLevel("medium");
              }}
              disabled={busy}
            >
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {modelLabels[model]}
                </option>
              ))}
            </select>

            <div className="panel-heading compact">
              <span>{provider === "openai" ? "추론 강도" : "Gemini Thinking"}</span>
              <strong>{provider === "openai" ? reasoningEffort : thinkingLevel}</strong>
            </div>
            {provider === "openai" ? (
              <Segment options={REASONING_EFFORTS} value={reasoningEffort} onChange={setReasoningEffort} disabled={busy} />
            ) : (
              <Segment options={GEMINI_THINKING} value={thinkingLevel} onChange={setThinkingLevel} disabled={busy} />
            )}

            <label className="field-label" htmlFor="keyword">키워드</label>
            <input
              id="keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="선택 키워드"
              disabled={busy}
            />

            <div className="generate-row">
              <ControlButton icon={Play} className="primary" onClick={generate} disabled={!canGenerate} busy={busy}>
                생성 <kbd>F1</kbd>
              </ControlButton>
              <ControlButton icon={RotateCcw} onClick={retry} disabled={!imageReady || busy} title="Retry">
                <kbd>F5</kbd>
              </ControlButton>
              <ControlButton icon={Square} onClick={cancel} disabled={!busy} title="Cancel">
                <kbd>Esc</kbd>
              </ControlButton>
            </div>
          </section>
        </section>

        <section className="result-panel">
          <div className="result-toolbar">
            <div>
              <span>결과</span>
              <strong>{currentModel}</strong>
            </div>
            <div className="toolbar-actions">
              <ControlButton icon={Copy} onClick={copyResult} disabled={!result.trim()}>
                복사 <kbd>Ctrl+C</kbd>
              </ControlButton>
              <ControlButton icon={Eraser} onClick={clearResult} disabled={!result.trim()}>
                지우기
              </ControlButton>
            </div>
          </div>
          <textarea
            value={busy && !result ? "생성 중..." : result}
            onChange={(event) => setResult(event.target.value)}
            placeholder="생성된 프롬프트가 여기에 표시됩니다."
            spellCheck="false"
          />
        </section>

        <aside className="history-panel">
          <div className="history-head">
            <div>
              <History size={17} />
              <strong>기록</strong>
            </div>
            <button onClick={clearHistory} disabled={!history.length} title="Clear history">
              <Trash2 size={15} />
            </button>
          </div>
          <div className="history-list">
            {history.length ? (
              history.map((entry) => (
                <button key={entry.id} className="history-item" onClick={() => applyHistory(entry)}>
                  <span>{entry.text.replace(/\s+/g, " ").slice(0, 88)}</span>
                  <small>
                    {modelLabels[entry.model] || entry.model} · {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </button>
              ))
            ) : (
              <div className="empty-history">
                <AlertTriangle size={18} />
                <span>로컬 기록 없음</span>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
