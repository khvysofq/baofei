import type { ReactNode } from "react";

export function SectionHeading({
  index,
  eyebrow,
  title,
  intro,
  id,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  id?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="label flex items-center gap-3">
        <span className="text-rust">{index}</span>
        <span className="h-px w-10 bg-line-strong" aria-hidden />
        <span>{eyebrow}</span>
      </p>
      <h2
        id={id}
        className="mt-4 text-[clamp(1.9rem,3.4vw,3.2rem)] font-black leading-[1.02] tracking-tight"
      >
        {title}
      </h2>
      {intro && (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-dim sm:text-lg">
          {intro}
        </p>
      )}
    </div>
  );
}