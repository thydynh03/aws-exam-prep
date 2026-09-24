import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import type { Plugin } from 'vite'

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
          try {
            // Nạp qua Vite để đường dẫn tính từ gốc project, không phải từ .vite-temp
            const mod = await server.ssrLoadModule('/src/server/app.ts');
            return (mod.app as any)(req, res, next);
          } catch (err) {
            console.error('API middleware error:', err);
            next(err);
          }
        } else {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiServerPlugin(),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('questions.json')) {
            return 'data-questions';
          }
          if (id.includes('node_modules')) {
            if (id.includes('mermaid') || id.includes('d3') || id.includes('dagre')) {
              return 'vendor-mermaid';
            }
            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('micromark') || id.includes('unist') || id.includes('mdast') || id.includes('katex')) {
              return 'vendor-markdown';
            }
            if (id.includes('html-to-image') || id.includes('html2canvas')) {
              return 'vendor-export';
            }
          }
        },
      },
    },
  },
})

