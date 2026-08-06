interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

/** Дотоод хуудсуудын товч хөх толгой — hero-гийн хөнгөн хувилбар. */
export default function PageHero({ eyebrow, title, subtitle }: Props) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-2.5 text-3xl font-black text-white sm:mt-3 sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:mt-4 sm:text-base">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
