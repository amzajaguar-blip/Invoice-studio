/**
 * Milo Design System — Web barrel export
 * ========================================
 * Import everything from this single path:
 *
 *   import { MiloButton, MiloCard, tokens, MOTION } from "@/components/ui/milo";
 *   import { useSuccessAnimation } from "@/components/ui/milo";
 *   import { useTheme, ThemeToggle } from "@/components/ui/milo";
 */

// Primitive components
export {
  MiloButton,
  MiloCard,
  MiloBadge,
  MiloDivider,
  MiloSpinner,
  MiloEmptyState,
} from "./milo";

// Animation hook + skeleton helpers
export {
  useSuccessAnimation,
  SkeletonBlock,
  SkeletonCard,
} from "../../hooks/useSuccessAnimation";

// Theme context + toggle button
export {
  ThemeProvider,
  useTheme,
  ThemeToggle,
} from "../../contexts/ThemeContext";

// Token objects (for JS-land usage, e.g. charts)
export {
  DARK_TOKENS,
  LIGHT_TOKENS,
  PALETTE,
  MOTION,
  TYPOGRAPHY,
  SHAPE,
  tokens,
} from "../../styles/tokens";
