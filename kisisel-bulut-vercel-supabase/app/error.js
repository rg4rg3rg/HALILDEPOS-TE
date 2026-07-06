"use client";

export default function GlobalError({ reset }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="logo" aria-hidden="true">!</div>
        <p className="eyebrow">Kişisel Bulut</p>
        <h1>Bir hata oluştu.</h1>
        <p className="muted">Lütfen bağlantıyı ve ortam değişkenlerini kontrol edin.</p>
        <button className="button button-primary button-wide" type="button" onClick={reset}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}
