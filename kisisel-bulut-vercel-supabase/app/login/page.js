import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Giriş" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="logo" aria-hidden="true">☁</div>
        <p className="eyebrow">Kişisel Bulut</p>
        <h1>Tekrar hoş geldin.</h1>
        <p className="muted">Özel dosya alanına erişmek için giriş yap.</p>
        <LoginForm />
      </section>
    </main>
  );
}
