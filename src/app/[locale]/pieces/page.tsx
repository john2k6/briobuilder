import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { PieceThumb } from "@/components/PieceThumb";
import { PageHeader, SectionTitle } from "@/components/ui";
import { pieceList } from "@/lib/catalog";
import type { PieceCategory } from "@/lib/track-engine";

export default function PiecesPage({ params }: PageProps<"/[locale]/pieces">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  const categories = [...new Set(pieceList.map((p) => p.category))] as PieceCategory[];

  return (
    <div className="space-y-12">
      <PageHeader title={t("pieces.title")} intro={t("pieces.intro")} />
      {categories.map((category) => (
        <section key={category} className="space-y-4">
          <SectionTitle className="!text-2xl">{t(`categories.${category}`)}</SectionTitle>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pieceList
              .filter((p) => p.category === category)
              .map((piece) => (
                <li key={piece.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                  <span className="wood-floor rounded-xl p-2">
                    <PieceThumb id={piece.id} className="h-24 w-full" />
                  </span>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-extrabold leading-tight text-ink">{t(`pieceNames.${piece.id}`)}</h3>
                    {!piece.verified && (
                      <span className="shrink-0 rounded-full border border-warn px-2 py-0.5 text-xs font-bold text-warn">
                        {t("pieces.toMeasure")}
                      </span>
                    )}
                  </div>
                  {piece.category !== "accessory" && (
                    <p className="font-mono text-sm text-muted">
                      {piece.ref && <>{t("pieces.ref", { ref: piece.ref })} · </>}
                      {t("pieces.length", { length: Math.round(piece.lengthMm) })} ·{" "}
                      {t("pieces.connectors", { count: piece.connectors.length })}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
