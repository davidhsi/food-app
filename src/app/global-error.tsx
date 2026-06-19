"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. Must render
 * its own <html>/<body>. Styled inline since global CSS may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f1e8",
          color: "#2b2a26",
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center",
          padding: "0 2rem",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>
          Please reload the app to continue.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 24,
            border: "none",
            borderRadius: 999,
            background: "#6b6f3f",
            color: "#f4f1e8",
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
