"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "Tarih yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function uploadToSignedUrl(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("x-upsert", "false");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("Supabase yüklemeyi reddetti."));
    });
    request.addEventListener("error", () => reject(new Error("Yükleme bağlantısı kesildi.")));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.send(body);
  });
}

export default function DashboardClient({
  currentUser,
  users,
  initialFiles,
  breadcrumbs,
  currentFolderId,
  initialError
}) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ownerId, setOwnerId] = useState(currentUser.id);
  const [toast, setToast] = useState(initialError ? { type: "error", message: initialError } : null);

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return initialFiles.filter((file) =>
      file.name.toLocaleLowerCase("tr-TR").includes(normalized)
    );
  }, [initialFiles, query]);

  function chooseFiles(fileList) {
    const files = [...(fileList || [])];
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setToast({ type: "error", message: `"${oversized.name}" 2 GB sınırını aşıyor.` });
      return;
    }
    setSelectedFiles(files);
    setToast(null);
  }

  async function uploadFiles() {
    if (!selectedFiles.length || uploading) return;
    setUploading(true);
    setProgress(0);
    let completed = 0;
    try {
      for (const file of selectedFiles) {
        const signResponse = await fetch("/api/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            type: file.type,
            parentId: currentFolderId,
            ownerId
          })
        });
        const signed = await signResponse.json();
        if (!signResponse.ok) throw new Error(signed.message || "Yükleme başlatılamadı.");

        await uploadToSignedUrl(signed.signedUrl, file, (ratio) => {
          setProgress(Math.round(((completed + ratio) / selectedFiles.length) * 100));
        });

        const completeResponse = await fetch("/api/files/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: signed.path,
            ownerId: signed.ownerId,
            parentId: signed.parentId,
            name: signed.name,
            size: file.size,
            type: file.type
          })
        });
        const completedResult = await completeResponse.json();
        if (!completeResponse.ok) {
          throw new Error(completedResult.message || "Dosya kaydı tamamlanamadı.");
        }
        completed += 1;
      }

      setToast({ type: "success", message: `${completed} dosya başarıyla yüklendi.` });
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setToast({ type: "error", message: error.message || "Dosyalar yüklenemedi." });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function createFolder() {
    const name = window.prompt("Yeni klasör adı:");
    if (!name) return;
    const response = await fetch("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: currentFolderId, ownerId })
    });
    const result = await response.json();
    setToast({
      type: response.ok ? "success" : "error",
      message: response.ok ? `"${name}" klasörü oluşturuldu.` : result.message
    });
    if (response.ok) router.refresh();
  }

  async function renameItem(item) {
    const name = window.prompt("Yeni ad:", item.name);
    if (!name || name === item.name) return;
    const response = await fetch(`/api/files/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const result = await response.json();
    setToast({
      type: response.ok ? "success" : "error",
      message: response.ok ? "Öğe yeniden adlandırıldı." : result.message
    });
    if (response.ok) router.refresh();
  }

  async function deleteItem(item) {
    if (!window.confirm(`"${item.name}" kalıcı olarak silinsin mi?`)) return;
    const response = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
    const result = await response.json();
    setToast({
      type: response.ok ? "success" : "error",
      message: response.ok ? `"${item.name}" silindi.` : result.message
    });
    if (response.ok) router.refresh();
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
        <nav className="topbar-actions" aria-label="Ana menü">
          {currentUser.role === "admin" ? <a className="nav-link" href="/admin">Admin paneli</a> : null}
          <span className="user-chip">{currentUser.username} · {currentUser.role}</span>
          <button className="icon-button" type="button" onClick={logout} aria-label="Çıkış yap">↪</button>
        </nav>
      </header>

      <main className="dashboard-shell">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">{currentUser.role === "admin" ? "Tüm kullanıcı dosyaları" : "Kişisel alanım"}</p>
            <h1>Dosyalar</h1>
            <p className="muted">{initialFiles.length} öğe bu klasörde.</p>
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

        <nav className="breadcrumbs" aria-label="Klasör yolu">
          <a href="/dashboard">Ana dizin</a>
          {breadcrumbs.map((folder) => (
            <span key={folder.id}>/ <a href={`/dashboard?folder=${folder.id}`}>{folder.name}</a></span>
          ))}
        </nav>

        <section className="toolbar">
          <button className="button button-secondary" type="button" onClick={createFolder}>＋ Yeni klasör</button>
          {currentUser.role === "admin" && !currentFolderId ? (
            <label className="owner-select">
              Yeni öğe sahibi
              <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                {users.map((user) => <option value={user.id} key={user.id}>{user.username}</option>)}
              </select>
            </label>
          ) : null}
        </section>

        <section className="upload-card">
          <div
            className={`drop-zone${dragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFiles(event.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={(event) => chooseFiles(event.target.files)}
              aria-label="Dosya seç"
            />
            <div className="upload-orb" aria-hidden="true">↑</div>
            <div>
              <h2>Dosyalarını buraya bırak</h2>
              <p>Tüm dosya türleri · Çoklu seçim · Dosya başına en fazla 2 GB</p>
              {selectedFiles.length ? (
                <p className="selected-file">
                  {selectedFiles.length} dosya · {formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
                </p>
              ) : null}
            </div>
          </div>
          {uploading ? (
            <div className="progress-wrap" aria-live="polite">
              <div className="progress-meta"><span>Dosyalar yükleniyor…</span><strong>{progress}%</strong></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            </div>
          ) : null}
          <button
            className="button button-primary upload-button"
            type="button"
            disabled={!selectedFiles.length || uploading}
            onClick={uploadFiles}
          >
            {uploading ? "Yükleniyor…" : `${selectedFiles.length || ""} Dosyayı yükle`}
          </button>
        </section>

        <section className="files-section">
          <div className="section-title"><h2>Klasör içeriği</h2><span>{visibleFiles.length} öğe</span></div>
          {visibleFiles.length ? (
            <div className="file-grid">
              {visibleFiles.map((item) => (
                <article className={`file-card ${item.kind}`} key={item.id}>
                  <div className="file-card-top">
                    <button
                      className="file-type"
                      type="button"
                      onClick={() => item.kind === "folder" && router.push(`/dashboard?folder=${item.id}`)}
                      aria-label={item.kind === "folder" ? `${item.name} klasörünü aç` : item.name}
                    >
                      {item.kind === "folder" ? "▰" : "▤"}
                    </button>
                    <div className="file-actions">
                      {item.kind === "file" ? (
                        <a className="icon-button" href={`/api/files/${item.id}/download`} title="İndir" aria-label={`${item.name} indir`}>↓</a>
                      ) : null}
                      <button className="icon-button" type="button" onClick={() => renameItem(item)} title="Yeniden adlandır">✎</button>
                      <button className="icon-button icon-danger" type="button" onClick={() => deleteItem(item)} title="Sil">×</button>
                    </div>
                  </div>
                  <h3>
                    {item.kind === "folder" ? <a href={`/dashboard?folder=${item.id}`}>{item.name}</a> : item.name}
                  </h3>
                  <p><span>{item.kind === "folder" ? "Klasör" : formatBytes(item.size)}</span><span>{formatDate(item.created_at)}</span></p>
                  {currentUser.role === "admin" ? <small>Sahibi: {item.owner_username}</small> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div aria-hidden="true">◇</div>
              <h3>{query ? "Eşleşen öğe yok" : "Bu klasör boş"}</h3>
              <p>{query ? "Başka bir arama terimi deneyin." : "Dosya yükleyin veya yeni klasör oluşturun."}</p>
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
