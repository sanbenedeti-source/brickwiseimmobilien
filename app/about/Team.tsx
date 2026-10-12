const leadership = [
  { name: "Pascal Mile", role: "Co-founder", initials: "PM" },
  { name: "M. Richi", role: "CTO", initials: "MR" },
];

const members = [
  { name: "L. Luko", role: "CFO", initials: "LL" },
  { name: "E. Bridge", role: "Creative Director", initials: "EB" },
  { name: "M. Paige", role: "VP of Customer Relations", initials: "MP" },
  { name: "A. Amzai", role: "Front-End Developer", initials: "AA" },
  { name: "D. Doome", role: "Legal", initials: "DD" },
  { name: "F. Miller", role: "DevOps", initials: "FM" },
  { name: "M. Gvilava", role: "Back-End / Blockchain Developer", initials: "MG" },
  { name: "F. Kein", role: "Designer", initials: "FK" },
];

function Initials({ value }: { value: string }) {
  return (
    <span aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[#dcebf5] bg-[#eaf4fb] text-3xl font-semibold tracking-tight text-[#168bd3] sm:h-28 sm:w-28 sm:text-4xl">
      {value}
    </span>
  );
}

export default function Team({ title, locale }: { title: string; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <section aria-labelledby="team-title" className="mt-20 border-t border-[#e2e7ec] pt-14">
      <h2 id="team-title" className="text-3xl font-bold sm:text-4xl">{title}</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {leadership.map((person) => (
          <article key={person.name} className="flex flex-col items-center rounded-xl bg-[#f4f7fa] px-6 py-9 text-center">
            <Initials value={person.initials} />
            <h3 className="mt-6 text-xl font-bold text-[#168bd3]">{person.name}</h3>
            <p className="mt-2 font-semibold text-[#111827]">{t(person.role)}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((person) => (
          <article key={person.name} className="flex items-center gap-5 py-3">
            <Initials value={person.initials} />
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-[#168bd3]">{person.name}</h3>
              <p className="mt-2 font-semibold leading-6 text-[#111827]">{t(person.role)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
import type { Locale } from "../lib/i18n";
import { createTranslator } from "../lib/translate";
