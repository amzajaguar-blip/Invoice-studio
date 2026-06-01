/**
 * Milo Design System — Mobile barrel export
 * ===========================================
 * Import everything from this single path:
 *
 *   import { MiloButton, MiloCard, useTheme, useSuccessAnimation } from "@/components/ui";
 */

// Primitive components
export {
  MiloButton,
  MiloCard,
  MiloStatusBadge,
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

// Theme context
export {
  ThemeProvider,
  useTheme,
  type ThemeMode,
  type ResolvedTheme,
} from "../../hooks/ThemeContext";

// Token constants (for direct style usage or charts)
export {
  DARK_COLORS,
  LIGHT_COLORS,
  COLORS,
  SIZES,
  SHADOWS,
  MOTION,
  makeShadows,
  resolveColors,
  getSystemColorScheme,
} from "../../constants/theme";
