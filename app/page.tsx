"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [h, setH] = useState(900);

  // Mets ton URL GAS ici (ou env)
  const GAS_URL =
    process.env.NEXT_PUBLIC_GAS_URL ||
    "https://script.google.com/macros/s/AKfycbw1m_Ermciy2ARlExFzgYRwa9WcB0ZXQp6B4D7-iZEbg3v2-WI6k7Q9a6GYfNr414E/exec";

  // Ajuste la hauteur selon la fenêtre (simple)
  useEffect(() => {
    const onResize = () => setH(Math.max(700, window.innerHeight));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const src = useMemo(() => GAS_URL, [GAS_URL]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        src={src}
        style={{
          width: "100%",
          height: h,
          border: 0,
          display: "block",
          background: "transparent",
        }}
        allow="camera; geolocation; microphone"
      />
    </div>
  );
}
