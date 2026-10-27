import { publicMetadata } from "../../lib/seo";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getCurrentLocale } from "../../lib/server-locale";
import { articleTranslations } from "./translations";

const posts = [
  {
    title: "How fractional real estate participation works",
    date: "23.04.2026",
    image: "/insight-1.jpg",
    slug: "how-fractional-real-estate-participation-works",
    content: `
Fractional real estate participation lets investors review a property without buying the whole asset. The model focuses on a defined property value, expected rent, participation amount, and payout structure.

In Fractional Investing Real Estate, the project page shows the modelled gross rent allocation for different access amounts. This makes it easier to compare properties before submitting a request.

The important point is discipline: the model is only useful when investors also review vacancy risk, costs, taxes, liquidity, and market conditions.
    `,
  },
  {
    title: "What to review before comparing rental yield",
    date: "21.04.2026",
    image: "/insight-2.jpg",
    slug: "what-to-review-before-comparing-rental-yield",
    content: `
Gross yield is only one part of a real estate decision. Investors should compare the property value with expected rent, then ask what costs or vacancy could reduce the result.

Canadian markets are local. A Toronto condo, a Calgary apartment, and a Montreal triplex can have very different affordability, rent, tax, and maintenance dynamics.

A clear review process starts with simple questions: where is the asset, who is likely to rent it, what income is assumed, and what could go wrong?
    `,
  },
  {
    title: "Why transparency matters in Canadian property access",
    date: "16.04.2026",
    image: "/insight-3.jpg",
    slug: "why-transparency-matters-in-canadian-property-access",
    content: `
Transparency matters because real estate decisions combine income, risk, liquidity, and timing. Investors need clear assumptions before they can compare opportunities.

A practical property page should show value, rent, gross yield, participation amount, payout model, and the main risk notes in one place.

Fractional Investing Real Estate is built around that idea: fewer vague claims, more structured information, and a cleaner path from interest to review.
    `,
  },
];

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getCurrentLocale();
  const post = posts.find(item => item.slug === slug);
  if (!post) notFound();
  const translated = locale === "en" ? null : articleTranslations[locale][slug];
  return publicMetadata('/insights/' + encodeURIComponent(slug), locale, { title: translated?.title ?? post.title, description: translated?.paragraphs[0] ?? post.content.trim().split("\n\n")[0], image: post.image, article: true });
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getCurrentLocale();
  const post = posts.find((item) => item.slug === slug);

  if (!post) {
    notFound();
  }

  const translated = locale === "en" ? null : articleTranslations[locale][slug];
  const title = translated?.title ?? post.title;
  const paragraphs = translated?.paragraphs ?? post.content.trim().split("\n\n");
  const [day, month, year] = post.date.split(".").map(Number);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));

  return (
    <main className="min-h-screen bg-canvas px-6 py-20">
      <article className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm text-gray-600">{date}</p>

        <h1 className="font-display mb-8 text-4xl font-bold leading-tight text-ink md:text-5xl">
          {title}
        </h1>

        <Image
          src={post.image}
          alt={title}
          width={1200}
          height={630}
          loading="eager"
          fetchPriority="high"
          className="mb-10 h-[420px] w-full rounded-2xl object-cover shadow"
        />

        <div className="space-y-6 text-lg leading-8 text-gray-800">
          {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
      </article>
    </main>
  );
}
