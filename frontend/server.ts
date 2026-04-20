import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);
  const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000';

  app.use(express.json());

  // Proxy API requests to the Python backend.
  app.post('/api/run-backtest', async (req, res) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/run-backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      const responseText = await response.text();
      const contentType = response.headers.get('content-type') ?? 'application/json';

      res.status(response.status);
      res.setHeader('Content-Type', contentType);
      res.send(responseText);
    } catch (error: unknown) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Unknown error while contacting backend.';

      res.status(502).json({
        status: 'error',
        detail: `Unable to reach backend at ${BACKEND_URL}. Start the FastAPI server and try again. (${detail})`,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
