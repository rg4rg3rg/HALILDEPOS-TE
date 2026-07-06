"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const ACTION_NAMES = {
  login: "Giriş yaptı",
  logout: "Çıkış yaptı",
  failed_login: "Başarısız giriş",
  file_uploaded: "Dosya yükledi",
  file_downloaded: "Dosya indirdi",
  file_deleted: "Dosya sildi",
  file_renamed: "Dosyayı yeniden adlandırdı",
  folder_created: "Klasör oluşturdu",
  folder_deleted: "Klasör sildi",
  folder_renamed: "Klasörü yeniden adlandırdı",
  user_created: "Kullanıcı oluşturdu",
  user_deleted: "Kullanıcı sildi",
  user_password_changed: "Şifre değiştirdi",
  user_role_changed: "Rol değiştirdi"
};

export default function AdminClient({ currentAdmin, initialUsers, logs, sessions, initialError }) {
  const router = useRouter();
  const [toast, setToast] = useState(initialError ? { type: "error", message: initialError } : null);
  const [creating, setCreating] = useState(false);

  async function createUser(event) {
    event.preventDefault();
    setCreating(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
        role: form.get("role")
      })
    });
    const result = await response.json();
    setToast({
      type: response.ok ? "success" : "error",
      message: response.ok ? "Kullanıcı oluşturuldu." : result.message
    });
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
    setCreating(false);
  }

  async function changePassword(user) {
    const password = window.prompt(`${user.username} için yeni şifre (en az 12 karakter):`);
    if (!password) return;
    await updateUser(user.id, { password }, "Şifre değiştirildi.");
  }

  async function changeRole(user, role) {
    await updateUser(user.id, { role }, "Kullanıcı rolü değiştirildi.");
  }

  async function updateUser(id, body, successMessage) {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    setToast({ type: response.ok ? "success" : "error", message: response.ok ? successMessage : result.message });
    if (response.ok) router.refresh();
  }

  async function deleteUser(user) {
    if (!window.confirm(`${user.username} ve tüm dosyaları kalıcı olarak silinsin mi?`)) return;
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const result = await response.json();
    setToast({
      type: response.ok ? "success" : "error",
      message: response.ok ? "Kullanıcı silindi." : result.message
    });
    if (response.ok) router.refresh();
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/dashboard"><span className="logo logo-small">☁</span><span>Kişisel Bulut</span></a>
        <nav className="topbar-actions"><a className="nav-link" href="/dashboard">Dosyalar</a><span className="user-chip">{currentAdmin.username} · admin</span></nav>
      </header>

      <main className="admin-shell">
        <section className="dashboard-heading">
          <div><p className="eyebrow">Yönetim merkezi</p><h1>Admin paneli</h1><p className="muted">Kullanıcılar, işlemler ve oturumlar.</p></div>
        </section>

        <section className="stats-grid">
          <article><strong>{initialUsers.length}</strong><span>Kullanıcı</span></article>
          <article><strong>{logs.length}</strong><span>Son işlem</span></article>
          <article><strong>{sessions.filter((item) => !item.revoked_at && new Date(item.expires_at) > new Date()).length}</strong><span>Aktif oturum</span></article>
          <article><strong>{logs.filter((item) => item.action === "failed_login").length}</strong><span>Başarısız giriş</span></article>
        </section>

        <section className="admin-grid">
          <article className="admin-card">
            <div className="section-title"><h2>Yeni kullanıcı</h2></div>
            <form className="admin-form" onSubmit={createUser}>
              <label>Kullanıcı adı<input name="username" minLength="3" maxLength="32" required /></label>
              <label>Şifre<input name="password" type="password" minLength="12" required /></label>
              <label>Rol<select name="role"><option value="user">user</option><option value="admin">admin</option></select></label>
              <button className="button button-primary" disabled={creating}>{creating ? "Oluşturuluyor…" : "Kullanıcı oluştur"}</button>
            </form>
          </article>

          <article className="admin-card admin-card-wide">
            <div className="section-title"><h2>Kullanıcılar</h2><span>{initialUsers.length} hesap</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Kullanıcı</th><th>Rol</th><th>Oluşturulma</th><th>İşlem</th></tr></thead>
                <tbody>
                  {initialUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}{user.id === currentAdmin.id ? " (siz)" : ""}</td>
                      <td>
                        <select value={user.role} disabled={user.id === currentAdmin.id} onChange={(event) => changeRole(user, event.target.value)}>
                          <option value="user">user</option><option value="admin">admin</option>
                        </select>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td className="table-actions">
                        <button className="button button-small" onClick={() => changePassword(user)}>Şifre değiştir</button>
                        <button className="button button-small button-danger" disabled={user.id === currentAdmin.id} onClick={() => deleteUser(user)}>Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="admin-card">
          <div className="section-title"><h2>Son işlemler</h2><span>Son 200 kayıt</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tarih</th><th>Kullanıcı</th><th>İşlem</th><th>Dosya</th><th>IP</th><th>Cihaz / Tarayıcı</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={log.success ? "" : "row-error"}>
                    <td>{formatDate(log.created_at)}</td><td>{log.username || "—"}</td>
                    <td>{ACTION_NAMES[log.action] || log.action}</td><td>{log.file_name || "—"}</td>
                    <td>{log.ip_address || "—"}</td><td title={log.user_agent}>{log.device_info || "—"}<small>{log.user_agent || ""}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <div className="section-title"><h2>Oturum geçmişi</h2><span>Son 100 oturum</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Kullanıcı</th><th>Başlangıç</th><th>Son kullanım</th><th>IP</th><th>Cihaz</th><th>Durum</th></tr></thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.username}</td><td>{formatDate(session.created_at)}</td><td>{formatDate(session.last_seen_at)}</td>
                    <td>{session.ip_address || "—"}</td><td title={session.user_agent}>{session.device_info || "—"}</td>
                    <td><span className={`status ${session.revoked_at || new Date(session.expires_at) <= new Date() ? "inactive" : "active"}`}>
                      {session.revoked_at ? "Kapatıldı" : new Date(session.expires_at) <= new Date() ? "Süresi doldu" : "Aktif"}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {toast ? <div className={`toast toast-${toast.type}`} role="status"><span>{toast.message}</span><button onClick={() => setToast(null)}>×</button></div> : null}
    </>
  );
}
