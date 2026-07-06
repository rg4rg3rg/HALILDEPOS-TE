"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password")
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.message || "Giriş yapılamadı.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <label htmlFor="username">Kullanıcı adı</label>
      <input
        id="username"
        name="username"
        type="text"
        defaultValue="admin"
        autoComplete="username"
        autoCapitalize="none"
        required
        autoFocus
      />

      <label htmlFor="password">Şifre</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <button className="button button-primary button-wide" type="submit" disabled={loading}>
        {loading ? "Giriş yapılıyor…" : "Giriş yap →"}
      </button>
    </form>
  );
}
