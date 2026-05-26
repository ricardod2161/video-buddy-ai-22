import { createFileRoute } from '@tanstack/react-router';

/**
 * TEMPORARY endpoint to reveal the LOVABLE_API_KEY value once,
 * so it can be copied into Render's environment variables.
 *
 * Authenticated using the WORKER_SECRET (same one configured in Render).
 * DELETE THIS FILE after copying the key.
 */
export const Route = createFileRoute('/api/public/reveal-lovable-key')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provided =
          request.headers.get('x-worker-secret') ??
          url.searchParams.get('secret') ??
          '';

        const workerSecret =
          process.env.WORKER_SECRET ??
          process.env.criar_video ??
          process.env.SEGREDO_DO_TRABALHADOR ??
          '';
        const lovableKey = process.env.LOVABLE_API_KEY ?? '';

        if (!workerSecret) {
          return new Response(
            JSON.stringify({ error: 'Worker secret not configured on server' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (provided.length === 0 || provided !== workerSecret) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (!lovableKey) {
          return new Response(
            JSON.stringify({ error: 'LOVABLE_API_KEY not available on server' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            LOVABLE_API_KEY: lovableKey,
            length: lovableKey.length,
            preview: `${lovableKey.slice(0, 6)}...${lovableKey.slice(-4)}`,
            warning: 'DELETE src/routes/api/public/reveal-lovable-key.ts after copying.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  },
});
