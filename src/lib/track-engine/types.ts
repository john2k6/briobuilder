// Types du moteur géométrique. Unités : millimètres et degrés.
// Repère : x vers la droite, y vers le haut, angles dans le sens trigonométrique.

export type Gender = "male" | "female";

export type PieceCategory =
  | "straight"
  | "curve"
  | "switch"
  | "crossing"
  | "ramp"
  | "adapter"
  | "tunnel"
  | "building"
  | "train";

/** Extrémité d'une pièce, dans le repère de la pièce. */
export interface Connector {
  x: number;
  y: number;
  /** Direction vers l'extérieur de la pièce (le rail suivant part dans cette direction). */
  angle: number;
  gender: Gender;
  /** 0 = sol, 1 = surélevé… */
  level: number;
}

/** Point d'un tracé de rail : x, y, niveau. */
export type TrackPoint = [x: number, y: number, level: number];

export interface PieceType {
  id: string;
  /** Référence fabricant d'une pièce compatible (ex. "33341"), pour la recherche. */
  ref: string | null;
  category: PieceCategory;
  connectors: Connector[];
  /** Lignes médianes des voies, pour le dessin SVG et le contrôle des chevauchements. */
  tracks: TrackPoint[][];
  lengthMm: number;
  /** false tant que les dimensions n'ont pas été mesurées sur une vraie pièce. */
  verified: boolean;
}

export interface Placement {
  id: string;
  pieceTypeId: string;
  x: number;
  y: number;
  rotation: number;
  /** Pièce retournée (miroir sur l'axe x de la pièce, avant rotation). */
  flipped: boolean;
}

/** Connecteur placé dans le plan. */
export interface WorldConnector extends Connector {
  placementId: string;
  index: number;
}

export interface SetContent {
  pieceTypeId: string;
  quantity: number;
}

export interface TrackSet {
  id: string;
  ref: string | null;
  contents: SetContent[];
  verified: boolean;
}

/** Inventaire : identifiant de pièce → quantité. */
export type Inventory = Record<string, number>;

export type Catalog = Record<string, PieceType>;
