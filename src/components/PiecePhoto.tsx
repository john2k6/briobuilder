import { catalog } from "@/lib/catalog";
import { officialImage } from "@/lib/official";
import { OfficialImage } from "./OfficialImage";
import { PieceThumb } from "./PieceThumb";

/**
 * Photo officielle du produit qui contient la pièce (lien direct chez le fabricant), avec notre dessin
 * en médaillon pour montrer exactement quelle pièce prendre. Sans photo : le dessin seul.
 */
export function PiecePhoto({ id, className = "" }: { id: string; className?: string }) {
  const src = officialImage(catalog[id]?.ref ?? null);
  const drawing = <PieceThumb id={id} className="w-full" />;
  return (
    <span className={`relative block overflow-hidden rounded-lg bg-white ring-1 ring-border ${className}`}>
      <OfficialImage
        src={src}
        className="aspect-[520/445] w-full object-contain p-0.5"
        fallback={<span className="wood-floor flex aspect-[520/445] items-center p-1">{drawing}</span>}
      />
      {src && (
        <span className="wood-floor absolute bottom-0 right-0 w-2/5 rounded-tl-lg p-0.5 ring-1 ring-border">
          {drawing}
        </span>
      )}
    </span>
  );
}
