import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita divulgar la versión del framework en la cabecera X-Powered-By.
  poweredByHeader: false,

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

  images: {
    // Fotos de categorías y productos, subidas a Cloudinary. next/image
    // exige autorizar el dominio explícitamente para optimizar imágenes
    // externas.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],

    // Sin esto, next/image rechaza con 400 CUALQUIER SVG local — el
    // escudo de la UNAL y el logo de AKOPIA incluidos — porque un SVG
    // puede llevar script embebido. Los nuestros son estáticos, propios
    // del repositorio, nunca subidos por un usuario, así que el riesgo
    // que esta bandera desactiva no aplica aquí. `contentSecurityPolicy`
    // es la mitigación que Next.js recomienda junto con la bandera: por
    // si acaso, bloquea que el SVG servido ejecute script propio.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
