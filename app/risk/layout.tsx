import { publicMetadata } from "@/app/lib/seo";
import { getCurrentLocale } from "@/app/lib/server-locale";
export async function generateMetadata() {
  return publicMetadata("/risk", await getCurrentLocale());
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
