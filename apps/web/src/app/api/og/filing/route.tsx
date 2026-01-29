import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const accession = request.nextUrl.searchParams.get("accession") || "unknown";

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 60,
      }}
    >
      <div
        style={{
          background: "#fafafa",
          color: "#09090b",
          padding: "12px 24px",
          borderRadius: 12,
          fontSize: 28,
          fontWeight: 700,
          alignSelf: "flex-start",
        }}
      >
        WhatsFiled
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: "#a1a1aa", fontSize: 36, marginBottom: 16 }}>
          SEC Form 4 Filing
        </span>
        <span
          style={{
            color: "#fafafa",
            fontSize: 48,
            fontWeight: 700,
            marginBottom: 24,
            fontFamily: "monospace",
          }}
        >
          {accession}
        </span>
        <span style={{ color: "#71717a", fontSize: 32 }}>
          Insider Transaction Details
        </span>
      </div>
      <span style={{ color: "#52525b", fontSize: 24, alignSelf: "flex-end" }}>
        whatsfiled.com
      </span>
    </div>,
    { width: 1200, height: 630 },
  );
}
