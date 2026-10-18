import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SettingsView } from "@/views/SettingsView";

export default function Page({ params }: PageProps<"/[locale]/settings">) {
  setRequestLocale(use(params).locale);
  return <SettingsView />;
}
