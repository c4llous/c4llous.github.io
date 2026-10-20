import { defineConfig, loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleContact, type ContactEnv } from './server/contact.ts';

/** Serves /api/contact from `vite` and `vite preview` with the same handler production uses. */
function contactApi(env: ContactEnv): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else if (v !== undefined) headers.set(k, v);
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const response = await handleContact(
      new Request(`http://${req.headers.host ?? 'localhost'}/api/contact`, {
        method: req.method,
        headers,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      }),
      env,
    );
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await response.text());
  };
  return {
    name: 'contact-api',
    configureServer: (server) => void server.middlewares.use('/api/contact', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/api/contact', handler),
  };
}

export default defineConfig(({ mode }) => ({
  // TELEGRAM_* / ALLOWED_ORIGINS stay server-side: only VITE_* vars are ever exposed to the browser.
  plugins: [contactApi(loadEnv(mode, process.cwd(), ['TELEGRAM_', 'ALLOWED_ORIGINS']))],
  build: {
    target: 'es2022',
    // three.js lives in its own lazily-loaded chunk (src/scene/World.ts); ~575 kB is expected.
    chunkSizeWarningLimit: 700,
  },
}));
