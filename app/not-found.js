export default function NotFound() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="logo" aria-hidden="true">!</div>
        <p className="eyebrow">Kişisel Bulut</p>
        <h1>Sayfa bulunamadı.</h1>
        <p className="muted">Aradığınız sayfa mevcut değil.</p>
        <a className="button button-primary button-wide" href="/">Ana sayfaya dön</a>
      </section>
    </main>
  );
}
