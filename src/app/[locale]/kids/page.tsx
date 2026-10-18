import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { KidsView } from "@/views/KidsView";

export default function Page({ params }: PageProps<"/[locale]/kids">) {
  setRequestLocale(use(params).locale);
  return <KidsView />;
}
