import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development"

const nextConfig: NextConfig = {
  output: "export",
  /**
   * Desarrollo y compilación escriben en carpetas distintas. Compartiendo
   * `renderer-build`, un `npm run build` borraba el directorio bajo los pies
   * del servidor de desarrollo y lo dejaba sirviendo «Internal Server Error»
   * hasta reiniciarlo. Electron sigue leyendo `renderer-build` en producción.
   */
  distDir: isDevelopment ? ".next-dev" : "renderer-build",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  ...(isDevelopment
    ? {
        async rewrites() {
          return [
            {
              source: "/__gemini/:path*",
              destination: "https://generativelanguage.googleapis.com/:path*",
            },
          ]
        },
      }
    : {}),
};

export default nextConfig;
