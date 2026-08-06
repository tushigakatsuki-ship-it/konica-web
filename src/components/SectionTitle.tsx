interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Гарчгийн доорх улбар шар зураас — landing дээрх хэсгүүдэд. */
  rule?: boolean;
}

export default function SectionTitle({ eyebrow, title, subtitle, rule }: Props) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-2xl font-extrabold sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-3 text-sm text-muted sm:mt-4 sm:text-base">{subtitle}</p>}
      {rule && <span className="mx-auto mt-6 block h-1 w-16 rounded-sm bg-accent" />}
    </div>
  );
}
