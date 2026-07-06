import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getBreadcrumbs, listDirectory } from "@/lib/files";
import { getSupabaseAdmin } from "@/lib/supabase";
import DashboardClient from "@/components/DashboardClient";

export const metadata = { title: "Dosyalarım" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const folderId = typeof params?.folder === "string" ? params.folder : null;

  let files = [];
  let breadcrumbs = [];
  let users = [];
  let loadError = "";
  try {
    [files, breadcrumbs] = await Promise.all([
      listDirectory(user, folderId),
      getBreadcrumbs(folderId, user)
    ]);
    if (isAdmin(user)) {
      const { data, error } = await getSupabaseAdmin()
        .from("users")
        .select("id, username, role")
        .eq("active", true)
        .order("username");
      if (error) throw error;
      users = data || [];
    }
  } catch (error) {
    console.error("Dashboard verisi alınamadı:", error);
    loadError = "Dosyalar Supabase üzerinden alınamadı. SQL şemasını ve ortam değişkenlerini kontrol edin.";
  }

  return (
    <DashboardClient
      currentUser={user}
      users={users}
      initialFiles={files}
      breadcrumbs={breadcrumbs}
      currentFolderId={folderId}
      initialError={loadError}
    />
  );
}
