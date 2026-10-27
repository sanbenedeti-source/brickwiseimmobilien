import { notFound } from "next/navigation";
import DashboardPage from "../page";

const sections = new Set(["marketplace", "assets", "account", "income", "wallet", "orders", "statement", "documents"]);

export default async function DashboardSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ request?: string; range?: string; dir?: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  const query = await searchParams;
  return <DashboardPage searchParams={Promise.resolve({ ...query, section })} />;
}
