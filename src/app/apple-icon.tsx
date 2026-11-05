import { ImageResponse } from "next/og";
import { MARK_INK, MARK_PATH, MARK_STROKE, MARK_TILE } from "@/components/shell/logo";

/*
 * The home-screen icon, generated from the same path as the mark and the
 * favicon (D52) rather than kept as a raster that drifts. Full-bleed orange:
 * iOS applies its own corner mask, so a drawn rounded tile would be rounded
 * twice.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: MARK_TILE,
        }}
      >
        <svg viewBox="0 0 64 64" width="180" height="180">
          <path
            d={MARK_PATH}
            fill="none"
            stroke={MARK_INK}
            strokeWidth={MARK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
