import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { BuildView } from "@/views/BuildView";

// Le circuit est décrit dans l'adresse (?c=…) : la page se construit dans le navigateur.
export default function Page({ params }: PageProps<"/[locale]/circuit/build">) {
  setRequestLocale(use(params).locale);
  return (
    <Suspense>
      <BuildView />
    </Suspense>
  );
}
