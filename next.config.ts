import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * AKOPIA es móvil primero, así que probarlo desde el celular por la IP
   * de la red local durante el desarrollo es el caso normal, no la
   * excepción. Sin esto, Next.js bloquea los recursos de `_next/` a
   * cualquier origen que no sea localhost — el JS nunca llega, React no
   * se hidrata, y los formularios caen al envío nativo del navegador
   * (por GET, con las contraseñas visibles en la URL). Es exactamente
   * lo que pasó al entrar desde el celular sin este ajuste.
   *
   * Si tu IP de red cambia (otro router, otra red), agrega la nueva IP
   * a esta lista y reinicia `npm run dev`. Next.js exige IPs concretas
   * aquí, no rangos.
   */
  allowedDevOrigins: ["192.168.0.100"],

  // Fotos de categorías y productos, subidas a Cloudinary. next/image
  // exige autorizar el dominio explícitamente para optimizar imágenes
  // externas.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
