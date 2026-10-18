import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CollectionView } from "@/views/CollectionView";

export default function Page({ params }: PageProps<"/[locale]/collection">) {
  setRequestLocale(use(params).locale);
  return <CollectionView />;
}
