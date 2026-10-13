import type { Metadata } from "next";

// The web UI was retired in favour of the iOS app (mobile/); this host serves
// the API plus the few pages Plaid Hosted Link redirects to.
export const metadata: Metadata = { title: "Financify", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B1B1B",
          color: "#FFFFFF",
          fontFamily: "-apple-system, system-ui, sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <main>{children}</main>
      </body>
    </html>
  );
}
