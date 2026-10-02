import { type DiagramId } from "@zoonk/core/library/activities/diagrams";
import { animalCell } from "./animal-cell";
import { atom } from "./atom";
import { type DiagramDrawing } from "./diagram-types";
import { digestiveSystem } from "./digestive-system";
import { earthLayers } from "./earth-layers";
import { electricCircuit } from "./electric-circuit";
import { flower } from "./flower";
import { humanEar } from "./human-ear";
import { humanEye } from "./human-eye";
import { humanHeart } from "./human-heart";
import { insect } from "./insect";
import { leafCrossSection } from "./leaf-cross-section";
import { neuron } from "./neuron";
import { plant } from "./plant";
import { plantCell } from "./plant-cell";
import { respiratorySystem } from "./respiratory-system";
import { volcano } from "./volcano";
import { waterCycle } from "./water-cycle";

/**
 * Every diagram in core's catalog, drawn with each of its parts. The type makes a missing diagram
 * or part a compile error, so the validator's list and the drawings can't drift apart.
 */
export const diagramDrawings: { [TId in DiagramId]: DiagramDrawing<TId> } = {
  "animal-cell": animalCell,
  atom,
  "digestive-system": digestiveSystem,
  "earth-layers": earthLayers,
  "electric-circuit": electricCircuit,
  flower,
  "human-ear": humanEar,
  "human-eye": humanEye,
  "human-heart": humanHeart,
  insect,
  "leaf-cross-section": leafCrossSection,
  neuron,
  plant,
  "plant-cell": plantCell,
  "respiratory-system": respiratorySystem,
  volcano,
  "water-cycle": waterCycle,
};
