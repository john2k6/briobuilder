import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { BoxView } from "@/views/BoxView";

export default function Page({ params }: PageProps<"/[locale]/box">) {
  setRequestLocale(use(params).locale);
  return <BoxView />;
}
