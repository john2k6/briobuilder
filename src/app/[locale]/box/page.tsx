import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { catalog, setList } from "@/lib/catalog";
import { addSet, generateLayouts } from "@/lib/track-engine";
import { BoxView } from "@/views/BoxView";

// Illustrations des coffrets : le meilleur circuit de chaque coffret seul, calculé une fois au moment du build.
const previews: Record<string, string | null> = Object.fromEntries(
  setList.map((set) => [
    set.id,
    set.kind === "pack"
      ? null
      : (generateLayouts(addSet({}, set), catalog, { decorate: true, limit: 1 }).buildable[0]?.code ?? null),
  ]),
);

export default function Page({ params }: PageProps<"/[locale]/box">) {
  setRequestLocale(use(params).locale);
  return <BoxView previews={previews} />;
}
