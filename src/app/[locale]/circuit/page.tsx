import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { CircuitView } from "@/views/CircuitView";

// Le circuit est décrit dans l'adresse (?c=…) : la page se construit dans le navigateur.
export default function Page({ params }: PageProps<"/[locale]/circuit">) {
  setRequestLocale(use(params).locale);
  return (
    <Suspense>
      <CircuitView />
    </Suspense>
  );
}
