import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { routing } from "@/i18n/routing";
import { layoutById, layouts } from "@/lib/layouts";
import { CircuitView } from "@/views/CircuitView";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => layouts.map((l) => ({ locale, id: l.id })));
}

export default function Page({ params }: PageProps<"/[locale]/circuits/[id]">) {
  const { locale, id } = use(params);
  setRequestLocale(locale);
  if (!layoutById[id]) notFound();
  return <CircuitView id={id} />;
}
