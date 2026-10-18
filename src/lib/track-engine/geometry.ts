import type {
  Catalog,
  Connector,
  PieceType,
  Placement,
  TrackPoint,
  WorldConnector,
} from "./types";

/** Écart de position toléré entre deux connecteurs raccordés (mm). */
export const POSITION_TOLERANCE = 3;
/** Écart d'angle toléré (degrés). */
export const ANGLE_TOLERANCE = 1;

export function normalizeAngle(angle: number): number {
  const a = angle % 360;
  return a < 0 ? a + 360 : a;
}

/** Plus petit écart entre deux angles, entre 0 et 180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return d > 180 ? 360 - d : d;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Place un point du repère de la pièce dans le plan. */
export function transformPoint(
  x: number,
  y: number,
  placement: Pick<Placement, "x" | "y" | "rotation" | "flipped">,
): [number, number] {
  const fy = placement.flipped ? -y : y;
  const r = rad(placement.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [placement.x + x * cos - fy * sin, placement.y + x * sin + fy * cos];
}

export function transformConnector(
  connector: Connector,
  placement: Pick<Placement, "x" | "y" | "rotation" | "flipped">,
): Connector {
  const [x, y] = transformPoint(connector.x, connector.y, placement);
  const local = placement.flipped ? -connector.angle : connector.angle;
  return { ...connector, x, y, angle: normalizeAngle(local + placement.rotation) };
}

/** Connecteurs d'une pièce placée, dans le plan. */
export function transform(placement: Placement, piece: PieceType): WorldConnector[] {
  return piece.connectors.map((c, index) => ({
    ...transformConnector(c, placement),
    placementId: placement.id,
    index,
  }));
}

export function transformTracks(placement: Placement, piece: PieceType): TrackPoint[][] {
  return piece.tracks.map((track) =>
    track.map(([x, y, level]) => [...transformPoint(x, y, placement), level] as TrackPoint),
  );
}

export function getPiece(catalog: Catalog, id: string): PieceType {
  const piece = catalog[id];
  if (!piece) throw new Error(`Pièce inconnue : ${id}`);
  return piece;
}

/**
 * Calcule le placement qui raccorde le connecteur `connectorIndex` de `piece`
 * au connecteur `target` déjà posé.
 */
export function attach(
  piece: PieceType,
  connectorIndex: number,
  target: Connector,
  options: { id: string; flipped?: boolean },
): Placement {
  const flipped = options.flipped ?? false;
  const c = piece.connectors[connectorIndex];
  if (!c) throw new Error(`Connecteur ${connectorIndex} absent de ${piece.id}`);
  const localAngle = flipped ? -c.angle : c.angle;
  const rotation = normalizeAngle(target.angle + 180 - localAngle);
  const [ox, oy] = transformPoint(c.x, c.y, { x: 0, y: 0, rotation, flipped });
  return {
    id: options.id,
    pieceTypeId: piece.id,
    x: target.x - ox,
    y: target.y - oy,
    rotation,
    flipped,
  };
}
