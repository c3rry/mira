// PropSpawner: All artificial interactive pillars and monuments removed per architectural spec
"use client";

import { PropItem } from "../store/useWorldStore";

interface PropSpawnerProps {
  propsList?: PropItem[];
  roomContext?: string;
  onPropClick?: (prop: PropItem) => void;
}

export function PropSpawner(_props: PropSpawnerProps) {
  // Artificial interactive pillars and monuments removed completely
  return null;
}
