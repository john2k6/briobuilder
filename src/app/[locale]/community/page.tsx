import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CommunityView } from "@/views/CommunityView";

export default function Page({ params }: PageProps<"/[locale]/community">) {
  setRequestLocale(use(params).locale);
  return <CommunityView />;
}
