/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Carimba o commit dentro do pacote na hora do build. É o único jeito de o
    // app saber qual versão ELE é — process.env.VERCEL_GIT_COMMIT_SHA só existe
    // no servidor, e o servidor sempre responde a versão mais nova publicada,
    // mesmo pra um aparelho que carregou uma antiga e nunca mais recarregou.
    NEXT_PUBLIC_PDM_VERSAO: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
  },
};

module.exports = nextConfig;
