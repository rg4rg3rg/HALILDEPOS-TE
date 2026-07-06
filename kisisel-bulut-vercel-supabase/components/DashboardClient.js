"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString("tr-TR", {
    maximumFractionDigits: 1
  })} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "Tarih yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function DashboardClient({ username, initialFiles, initialError }) {
  const router = useRouter();
  const fileInput = useRef(null);
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(
    initialError ? { type: "error", message: initialError } : null
  );

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return initialFiles.filter((file) =>
      file.name.toLocaleLowerCase("tr-TR").includes(normalized)
    );
  }, [initialFiles, query]);

  function chooseFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setToast({ type: "error", message: "Dosya 2 GB sınırını aşıyor." });
      return;
    }
    setSelectedFile(file);
    setToast(null);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function uploadFile() {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setProgress(0);
    setToast(null);

    try {
      const signResponse = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type
        })
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.message || "Yükleme başlatılamadı.");

      await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", signed.signedUrl);
        request.setRequestHeader("x-upsert", "false");
        request.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        request.addEventListener("load", () => {
          if (request.status >= 200 && request.status < 300) resolve();
          else reject(new Error("Supabase yüklemeyi reddetti."));
        });
        request.addEventListener("error", () => reject(new Error("Ağ bağlantısı kesildi.")));
        const uploadBody = new FormData();
        uploadBody.append("cacheControl", "3600");
        uploadBody.append("", selectedFile);
        request.send(uploadBody);
      });

      setToast({ type: "success", message: `"${selectedFile.name}" yüklendi.` });
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (error) {
      setToast({ type: "error", message: error.message || "Dosya yüklenemedi." });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function deleteFile(file) {
    if (!window.confirm(`"${file.name}" kalıcı olarak silinsin mi?`)) return;
    const response = await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file.path })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast({ type: "error", message: result.message || "Dosya silinemedi." });
      return;
    }
    setToast({ type: "success", message: `"${file.name}" silindi.` });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/dashboard">
          <span className="logo logo-small" aria-hidden="true">☁</span>
          <span>Kişisel Bulut</span>
        </a>
        <div className="topbar-actions">
          <span className="user-chip">{username}</span>
          <button className="icon-button" type="button" onClick={logout} aria-label="Çıkış yap">
            ↪
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">Supabase Storage</p>
            <h1>Dosyalarım</h1>
            <p className="muted">{initialFiles.length} dosya güvenli alanında.</p>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Dosyalarda ara…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Dosyalarda ara"
            />
          </label>
        </section>

        <section className="upload-card">
          <div
            className={`drop-zone${dragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInput}
              type="file"
              onChange={(event) => chooseFile(event.target.files?.[0])}
              aria-label="Dosya seç"
            />
            <div className="upload-orb" aria-hidden="true">↑</div>
            <div>
              <h2>Dosyanı buraya bırak</h2>
              <p>veya seçmek için tıkla · En fazla 2 GB</p>
              {selectedFile ? (
                <p className="selected-file">
                  {selectedFile.name} · {formatBytes(selectedFile.size)}
                </p>
              ) : null}
            </div>
          </div>

          {uploading ? (
            <div className="progress-wrap" aria-live="polite">
              <div className="progress-meta">
                <span>Yükleniyor…</span><strong>{progress}%</strong>
              </div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            </div>
          ) : null}

          <button
            className="button button-primary upload-button"
            type="button"
            disabled={!selectedFile || uploading}
            onClick={uploadFile}
          >
            {uploading ? "Yükleniyor…" : "Yüklemeyi başlat"}
          </button>
        </section>

        <section className="files-section">
          <div className="section-title">
            <h2>Tüm dosyalar</h2><span>{visibleFiles.length} öğe</span>
          </div>

          {visibleFiles.length ? (
            <div className="file-grid">
              {visibleFiles.map((file) => (
                <article className="file-card" key={file.path}>
                  <div className="file-card-top">
                    <span className="file-type" aria-hidden="true">▤</span>
                    <div className="file-actions">
                      <a
                        className="icon-button"
                        href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                        aria-label={`${file.name} dosyasını indir`}
                        title="İndir"
                      >
                        ↓
                      </a>
                      <button
                        className="icon-button icon-danger"
                        type="button"
                        onClick={() => deleteFile(file)}
                        aria-label={`${file.name} dosyasını sil`}
                        title="Sil"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <h3 title={file.name}>{file.name}</h3>
                  <p><span>{formatBytes(file.size)}</span><span>{formatDate(file.createdAt)}</span></p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div aria-hidden="true">◇</div>
              <h3>{query ? "Eşleşen dosya yok" : "Henüz dosya yok"}</h3>
              <p>{query ? "Başka bir arama terimi dene." : "İlk dosyanı yukarıdaki alandan yükle."}</p>
            </div>
          )}
        </section>
      </main>

      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status">
          <span>{toast.type === "success" ? "✓" : "!"}</span>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Bildirimi kapat">×</button>
        </div>
      ) : null}
    </>
  );
}
