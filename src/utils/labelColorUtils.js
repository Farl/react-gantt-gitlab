/**
 * Shared utilities for GitLab label badge color rendering.
 * Used by: LabelBadge (shared component) — all label badge rendering goes through LabelBadge.
 *
 * Uses a simplified APCA (Accessible Perceptual Contrast Algorithm) to choose
 * between white and black text. APCA is polarity-aware — it recognizes that
 * light text on dark backgrounds is more readable than dark text on light
 * backgrounds at the same mathematical contrast ratio. This produces better
 * results than WCAG 2.0 for mid-tones (e.g. #808080 correctly gets white text
 * instead of black).
 *
 * Reference: https://github.com/Myndex/SAPC-APCA (APCA-W3 0.98G-4g constants)
 */

// --- APCA-W3 0.98G-4g constants ---
const B_THRSH = 0.022; // Black soft-clip threshold
const B_CLIP = 1.414; // Black soft-clip exponent
const N_TX = 0.57; // Normal polarity (dark text on light bg) — text exponent
const N_BG = 0.56; // Normal polarity — background exponent
const R_TX = 0.62; // Reverse polarity (light text on dark bg) — text exponent
const R_BG = 0.65; // Reverse polarity — background exponent
const W_SCALE = 1.14; // Output scaling factor
const W_OFFSET = 0.027; // Output offset
const W_CLAMP = 0.1; // Minimum meaningful contrast

// Precomputed luminance for black and white — avoids redundant work per badge render
let Y_BLACK;
let Y_WHITE;

/**
 * Converts a single sRGB channel (0–1) to linear-light value.
 * Uses the standard sRGB transfer function (same exponent as APCA-W3: 2.4).
 */
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Computes estimated luminance (Y) from a hex color, with APCA black soft-clip.
 * @param {string} hex - CSS hex color string, e.g. '#a8d1f0'
 * @returns {number} Soft-clipped luminance Y
 */
function luminanceY(hex) {
  const c = hex.replace('#', '');
  const r = srgbToLinear(parseInt(c.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(c.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(c.slice(4, 6), 16) / 255);
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  // Soft-clip near-black to avoid division artifacts
  return Y < B_THRSH ? Y + Math.pow(B_THRSH - Y, B_CLIP) : Y;
}

/**
 * Computes APCA perceptual lightness contrast (Lc) for a text/background pair.
 * Positive Lc = dark text on light bg; negative Lc = light text on dark bg.
 * @param {number} Ytxt - Text luminance (soft-clipped)
 * @param {number} Ybg  - Background luminance (soft-clipped)
 * @returns {number} Lc value (range roughly -108 to +106)
 */
function apcaLc(Ytxt, Ybg) {
  let SAPC;
  if (Ybg > Ytxt) {
    // Normal polarity: dark text on light background
    SAPC = (Math.pow(Ybg, N_BG) - Math.pow(Ytxt, N_TX)) * W_SCALE;
  } else {
    // Reverse polarity: light text on dark background
    SAPC = (Math.pow(Ybg, R_BG) - Math.pow(Ytxt, R_TX)) * W_SCALE;
  }
  if (Math.abs(SAPC) < W_CLAMP) return 0;
  return (SAPC > 0 ? SAPC - W_OFFSET : SAPC + W_OFFSET) * 100;
}

/**
 * Returns '#fff' or '#000' — whichever produces a higher APCA |Lc| value
 * (i.e. better perceptual readability) against the given background color.
 *
 * Used internally by getLabelStyle().
 * @param {string} hex - CSS hex color string, e.g. '#a8d1f0'
 * @returns {'#fff'|'#000'}
 */
export function getContrastColor(hex) {
  if (!hex) return '#fff';
  if (hex.replace('#', '').length !== 6) return '#fff';
  // Lazy-init to avoid TDZ (luminanceY is declared above but uses module-level constants)
  if (Y_BLACK === undefined) {
    Y_BLACK = luminanceY('#000000');
    Y_WHITE = luminanceY('#ffffff');
  }
  const Ybg = luminanceY(hex);
  const lcBlack = Math.abs(apcaLc(Y_BLACK, Ybg));
  const lcWhite = Math.abs(apcaLc(Y_WHITE, Ybg));
  return lcWhite >= lcBlack ? '#fff' : '#000';
}

/**
 * Returns inline style props for a label badge.
 * Picks white or black text for maximum APCA perceptual contrast.
 * @param {string} bgColor - CSS hex color string
 * @returns {{ color: string }}
 */
export function getLabelStyle(bgColor) {
  return {
    color: getContrastColor(bgColor),
  };
}
