import { redirect } from "next/navigation";

// No ?lang= here: proxy.ts treats a lang parameter as a manual choice and would
// pin the visitor's language for a year. The home page detects it as usual.
export default function HowItWorksPage() {
  redirect("/#how-it-works");
}
