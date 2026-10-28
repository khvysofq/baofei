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
        className="mt-4 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl"
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