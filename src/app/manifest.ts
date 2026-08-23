import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La compra",
    short_name: "La compra",
    description: "Hucha de casa: escanea tickets y mira el gasto.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3eee4",
    theme_color: "#0f3d2e",
    lang: "es",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
