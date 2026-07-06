import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listFiles } from "@/lib/files";
import DashboardClient from "@/components/DashboardClient";

export const metadata = { title: "Dosyalarım" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let files = [];
  let loadError = "";
  try {
    files = await listFiles();
  } catch (error) {
    console.error("Supabase listeleme hatası:", error);
    loadError = "Dosyalar Supabase üzerinden alınamadı. Bucket ve ortam değişkenlerini kontrol edin.";
  }

  return (
    <DashboardClient
      username={session.username}
      initialFiles={files}
      initialError={loadError}
    />
  );
}
