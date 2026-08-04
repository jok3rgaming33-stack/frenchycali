import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { AdminPanel } from "@/components/admin-panel"

export const metadata = { title: "Admin — FrenchyCali", robots: "noindex" }

export default async function AdminPage() {
  const authed = await isAdminAuthenticated()
  if (!authed) redirect("/admin/login")
  return <AdminPanel />
}
