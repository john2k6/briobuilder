"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useCircuitName } from "@/components/CircuitCard";
import { TrackPlan } from "@/components/TrackPlan";
import { blob, buttonPrimary, buttonSecondary, card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { circuitFromCode, circuitHref } from "@/lib/circuits";
import { approvedPhotos, communityEnabled, reportPhoto, type CommunityPhoto } from "@/lib/community";

const PAGE = 24;

/** Circuits des internautes : la photo du circuit construit à côté de son plan, validées avant publication. */
export function CommunityView() {
  const t = useTranslations();
  const nameOf = useCircuitName();
  const [photos, setPhotos] = useState<CommunityPhoto[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!communityEnabled) return;
    approvedPhotos(page, PAGE)
      .then((list) => {
        setPhotos((prev) => [...(page === 0 ? [] : (prev ?? [])), ...list]);
        setMore(list.length === PAGE);
      })
      .catch(() => setFailed(true));
  }, [page]);

  const intro = <PageHeader title={t("community.title")} intro={t("community.intro")} />;

  if (!communityEnabled || failed) {
    return (
      <div className="space-y-8">
        {intro}
        <p className={`${card} p-6 text-lg`}>{failed ? t("community.unavailable") : t("community.soon")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {intro}
      {photos === null ? (
        <p className="text-muted">{t("community.loading")}</p>
      ) : photos.length === 0 ? (
        <div className={`${card} space-y-4 p-6`}>
          <p className="text-lg">{t("community.empty")}</p>
          <Link href="/circuits" className={buttonPrimary}>
            {t("community.first")}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {photos.map((p) => {
            const circuit = circuitFromCode(p.code);
            return (
              <li key={p.id} className={`${blob} flex flex-col border border-border bg-surface`}>
                <div className="grid grid-cols-2 gap-1 bg-soft">
                  {p.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={t("community.photoAlt")} className="aspect-square w-full object-cover" />
                  )}
                  <div className="wood-floor flex aspect-square items-center p-2">
                    {circuit && (
                      <TrackPlan
                        placements={circuit.placements}
                        catalog={catalog}
                        accessories={circuit.accessories}
                        title={nameOf(circuit)}
                        showConnectors={false}
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <h2 className="font-extrabold text-ink">{circuit ? nameOf(circuit) : t("community.unknown")}</h2>
                    {circuit && <p className="text-sm text-muted">{t("common.pieces", { count: circuit.pieces })}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {circuit && (
                      <Link href={circuitHref(p.code)} className={buttonSecondary}>
                        {t("community.build")}
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={reported.has(p.id)}
                      className="text-sm font-bold text-muted underline disabled:no-underline"
                      onClick={() =>
                        reportPhoto(p.id)
                          .then(() => setReported((s) => new Set(s).add(p.id)))
                          .catch(() => undefined)
                      }
                    >
                      {reported.has(p.id) ? t("community.reported") : t("community.report")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {more && (
        <button type="button" className={`${buttonSecondary} w-full`} onClick={() => setPage(page + 1)}>
          {t("community.more")}
        </button>
      )}
      <p className="text-sm text-muted">{t("community.rules")}</p>
    </div>
  );
}
