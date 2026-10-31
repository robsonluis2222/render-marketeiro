# Renderizador Remotion do AI Video Factory

## Instalação

```bash
cd server/remotion
npm ci
npx remotion browser ensure
export PORT=8787
npm start
```

A API fica em `/health`, `/render`, `/render/:id`, `/render/:id/file` e `/assets`.
O frontend deve usar a URL pública deste serviço em `remotion_url`.

Para validar a instalação:

```bash
npm run render:validate
```

O JSX é validado pelo bundler do Remotion durante a primeira renderização; não use `node --check` diretamente em `src/index.jsx`.

O serviço recebe o roteiro, o áudio ElevenLabs já produzido e o manifesto de assets, renderiza MP4 vertical e mantém os assets no diretório `storage/assets`.
