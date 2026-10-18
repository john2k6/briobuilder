import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { TrackPlan } from "@/components/TrackPlan";
import { catalog, pieceList, setList } from "@/lib/catalog";
import { totalPieces, addSet, type PieceCategory } from "@/lib/track-engine";

export default function PiecesPage({ params }: PageProps<"/[locale]/pieces">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  const categories = [...new Set(pieceList.map((p) => p.category))] as PieceCategory[];

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="font-display text-4xl font-semibold">{t("pieces.title")}</h1>
        <p className="max-w-2xl text-muted">{t("pieces.intro")}</p>
      </header>

      {categories.map((category) => (
        <section key={category} className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">{t(`categories.${category}`)}</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pieceList
              .filter((p) => p.category === category)
              .map((piece) => {
                const name = t(`pieceNames.${piece.id}`);
                return (
                  <li key={piece.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                    <TrackPlan
                      placements={[{ id: piece.id, pieceTypeId: piece.id, x: 0, y: 0, rotation: 0, flipped: false }]}
                      catalog={catalog}
                      title={name}
                      frame={{ width: 300, height: 220 }}
                      className="h-36 w-full"
                    />
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{name}</h3>
                      {!piece.verified && (
                        <span className="shrink-0 rounded-full border border-warn px-2 py-0.5 text-xs text-warn">
                          {t("pieces.toMeasure")}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-sm text-muted">
                      {piece.ref && <>{t("pieces.ref", { ref: piece.ref })} · </>}
                      {t("pieces.length", { length: Math.round(piece.lengthMm) })} ·{" "}
                      {t("pieces.connectors", { count: piece.connectors.length })}
                    </p>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">{t("pieces.setsTitle")}</h2>
        <p className="text-muted">{t("pieces.setsIntro")}</p>
        <ul className="grid gap-4 md:grid-cols-3">
          {setList.map((set) => (
            <li key={set.id} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t(`setNames.${set.id}`)}</h3>
                {!set.verified && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    {t("pieces.example")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">{t("pieces.setPieces", { count: totalPieces(addSet({}, set)) })}</p>
              <ul className="text-sm">
                {set.contents.map((item) => (
                  <li key={item.pieceTypeId} className="flex justify-between gap-2">
                    <span>{t(`pieceNames.${item.pieceTypeId}`)}</span>
                    <span className="font-mono">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
