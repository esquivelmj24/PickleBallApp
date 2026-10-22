import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickle & Chill — Pickleball Leveling Console",
  description:
    "Committee tool for rating players, building balanced pickleball courts, and tracking fair rotations.",
};

export const viewport: Viewport = {
  themeColor: "#0B3D34",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="classic" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("pickle-theme");if(["classic","dark","gray","yellow"].indexOf(t)>-1){document.documentElement.dataset.theme=t;}}catch(e){}})();',
          }}
        />
        <div className="site-backdrop" aria-hidden>
          <span className="site-backdrop-image" />
          <span className="site-backdrop-wash" />
        </div>
        {children}
      </body>
    </html>
  );
}
