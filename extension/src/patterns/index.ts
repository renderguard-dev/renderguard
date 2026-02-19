import type { PatternDetector } from "../types";
import { inlineObjectsDetector } from "./inlineObjects";
import { inlineFunctionsDetector } from "./inlineFunctions";
import { missingMemoDetector } from "./missingMemo";
import { unstableKeysDetector } from "./unstableKeys";
import { unstableDepsDetector } from "./unstableDeps";
import { broadContextDetector } from "./broadContext";
import { derivedStateDetector } from "./derivedState";
import { propsDrillingDetector } from "./propsDrilling";
import { liftedStateDetector } from "./liftedState";

export const allDetectors: PatternDetector[] = [
  inlineObjectsDetector,
  inlineFunctionsDetector,
  missingMemoDetector,
  unstableKeysDetector,
  unstableDepsDetector,
  broadContextDetector,
  derivedStateDetector,
  propsDrillingDetector,
  liftedStateDetector,
];
