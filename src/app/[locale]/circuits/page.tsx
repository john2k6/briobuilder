import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CircuitsView } from "@/views/CircuitsView";

export default function Page({ params }: PageProps<"/[locale]/circuits">) {
  setRequestLocale(use(params).locale);
  return <CircuitsView />;
}
