/**
 * Premium Barber Panel Design System
 * Gold + Teal color palette, glassy effects, modern spacing
 */

export const barberDesign = {
  // ─── Colors ──────────────────────────────────────────────────────────
  colors: {
    // Primary: Gold (warm, luxury)
    gold: "#d4af37",
    goldAlt: "#f0c040",
    goldLight: "#e8c547",
    goldDark: "#b8941f",

    // Secondary: Teal (professional, calm)
    teal: "#0f766e",
    tealLight: "#14b8a6",
    tealLighter: "#7ee8d8",
    tealDark: "#0d4f4b",

    // Accents
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",

    // Neutrals
    bg: "#020817",
    bgAlt: "#0f1419",
    surface: "#1a1f2e",
    surfaceAlt: "#242c3e",
    surfaceRaised: "#2d3546",
    border: "rgba(255,255,255,0.08)",
    borderAlt: "rgba(255,255,255,0.14)",
    text: "#ffffff",
    textSecondary: "#cbd5e1",
    textTertiary: "rgba(255,255,255,0.65)",
    muted: "#64748b",
  },

  // ─── Spacing ─────────────────────────────────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
  },

  // ─── Typography ──────────────────────────────────────────────────────
  typography: {
    // Display
    display: {
      fontSize: 48,
      fontWeight: "900",
      letterSpacing: 2,
      lineHeight: 56,
    },
    // Heading 1
    h1: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: 1,
      lineHeight: 40,
    },
    // Heading 2
    h2: {
      fontSize: 26,
      fontWeight: "700",
      letterSpacing: 0.8,
      lineHeight: 32,
    },
    // Heading 3
    h3: {
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: 0.6,
      lineHeight: 28,
    },
    // Body (large)
    bodyLg: {
      fontSize: 16,
      fontWeight: "500",
      letterSpacing: 0.3,
      lineHeight: 24,
    },
    // Body (default)
    body: {
      fontSize: 14,
      fontWeight: "500",
      letterSpacing: 0.2,
      lineHeight: 22,
    },
    // Caption
    caption: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      lineHeight: 18,
    },
    // Eyebrow
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 2.5,
      lineHeight: 16,
      textTransform: "uppercase" as const,
    },
  },

  // ─── Shadows ─────────────────────────────────────────────────────────
  shadows: {
    // Subtle
    subtle: {
      shadowColor: "#d4af37",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    // Small
    small: {
      shadowColor: "#d4af37",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    // Medium
    medium: {
      shadowColor: "#d4af37",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    // Large
    large: {
      shadowColor: "#d4af37",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 24,
      elevation: 12,
    },
  },

  // ─── Border Radius ───────────────────────────────────────────────────
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 99,
  },

  // ─── Component-specific ──────────────────────────────────────────────
  button: {
    primary: {
      bg: "#d4af37",
      text: "#020817",
      activeOpacity: 0.85,
    },
    secondary: {
      bg: "rgba(212,175,55,0.12)",
      text: "#d4af37",
      activeOpacity: 0.85,
    },
    teal: {
      bg: "#0f766e",
      text: "#ffffff",
      activeOpacity: 0.85,
    },
  },

  card: {
    bg: "rgba(212,175,55,0.06)",
    bgAlt: "rgba(212,175,55,0.04)",
    border: "rgba(212,175,55,0.18)",
    borderAlt: "rgba(212,175,55,0.10)",
  },

  badge: {
    gold: {
      bg: "rgba(212,175,55,0.15)",
      text: "#f0c040",
      border: "rgba(212,175,55,0.25)",
    },
    teal: {
      bg: "rgba(15,118,110,0.15)",
      text: "#14b8a6",
      border: "rgba(15,118,110,0.25)",
    },
  },

  input: {
    bg: "rgba(212,175,55,0.05)",
    border: "rgba(212,175,55,0.15)",
    borderFocus: "rgba(212,175,55,0.40)",
    text: "#ffffff",
    placeholder: "rgba(212,175,55,0.50)",
  },
};

export default barberDesign;
