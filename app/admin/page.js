import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import AdminClient from "@/components/AdminClient";

export const metadata = { title: "Admin Paneli" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (!isAdmin(admin)) redirect("/dashboard");

  let users = [];
  let logs = [];
  let sessions = [];
  let errorMessage = "";
  try {
    const supabase = getSupabaseAdmin();
    const [userResult, logResult, sessionResult] = await Promise.all([
      supabase.from("users").select("id, username, role, active, created_at").order("created_at"),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("sessions")
        .select("id, user_id, ip_address, user_agent, device_info, created_at, last_seen_at, expires_at, revoked_at")
        .order("created_at", { ascending: false })
        .limit(100)
    ]);
    if (userResult.error) throw userResult.error;
    if (logResult.error) throw logResult.error;
    if (sessionResult.error) throw sessionResult.error;
    users = userResult.data || [];
    logs = logResult.data || [];
    const userMap = Object.fromEntries(users.map((user) => [user.id, user.username]));
    sessions = (sessionResult.data || []).map((session) => ({
      ...session,
      username: userMap[session.user_id] || "Silinmiş kullanıcı"
    }));
  } catch (error) {
    console.error("Admin paneli verisi alınamadı:", error);
    errorMessage = "Admin verileri alınamadı. Supabase SQL şemasını kontrol edin.";
  }

  return (
    <AdminClient
      currentAdmin={admin}
      initialUsers={users}
      logs={logs}
      sessions={sessions}
      initialError={errorMessage}
    />
  );
}
