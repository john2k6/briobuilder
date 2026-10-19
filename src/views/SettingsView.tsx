"use client";

import { deleteAllMyPhotos } from "@/lib/community";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonPrimary, buttonSecondary, card, Icon, icons, PageHeader } from "@/components/ui";
import { actions } from "@/lib/store";

const VERSION = "0.4 beta";

export function SettingsView() {
  const t = useTranslations("settings");
  const [deleted, setDeleted] = useState(false);

  const download = () => {
    const blob = new Blob([actions.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rail-builder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAll = () => {
    if (!window.confirm(t("deleteConfirm"))) return;
    actions.deleteAll();
    // Les photos partagées depuis cet appareil sont retirées aussi.
    void deleteAllMyPhotos().catch(() => undefined);
    setDeleted(true);
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} />
      <section className={`${card} space-y-4 p-6`}>
        <h2 className="font-display text-2xl font-bold">{t("dataTitle")}</h2>
        <p className="max-w-2xl text-muted">{t("dataText")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonSecondary} onClick={download}>
            <Icon d={icons.download} className="size-5" />
            {t("export")}
          </button>
          <button type="button" className={buttonPrimary} onClick={deleteAll}>
            <Icon d={icons.trash} className="size-5" />
            {t("deleteAll")}
          </button>
        </div>
        {deleted && (
          <p role="status" className="font-semibold text-green">
            {t("deleted")}
          </p>
        )}
      </section>
      <section className={`${card} space-y-2 p-6`}>
        <h2 className="font-display text-2xl font-bold">{t("about")}</h2>
        <p className="text-muted">{t("aboutText", { version: VERSION })}</p>
        <p className="text-muted">{t("privacy")}</p>
      </section>
    </div>
  );
}
