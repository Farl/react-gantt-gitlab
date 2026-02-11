import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Check if we're building demos
  const isDemoBuild = process.env.BUILD_DEMOS === 'true';
  // Check if we're building full CSS
  const isFullCssBuild = process.env.BUILD_FULL_CSS === 'true';

  if (isDemoBuild) {
    // Demo build configuration - includes all dependencies
    // Use relative path for static hosting compatibility
    // Some hosts use root path '/' while GitHub Pages may use subpath
    const base = process.env.VITE_BASE_PATH || '/';

    return {
      plugins: [react()],
      base: base,
      build: {
        outDir: 'dist-demos',
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html'),
          },
        },
      },
    };
  }

  const rollupOptions = {
    output: {
      assetFileNames: 'index.css',
    },
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  };

  const rollupOptionsStrict = {
    ...rollupOptions,
    external: [
      ...rollupOptions.external,
      /^@wx\//, // matches all modules starting with "@wx/"
      /^@svar-ui\//, // matches all modules starting with "@svar-ui/"
    ],
  };

  if (isFullCssBuild) {
    // Full CSS build configuration - includes base styles and component styles
    return {
      plugins: [react()],
      build: {
        outDir: 'dist-full',
        lib: {
          entry: resolve(__dirname, 'src/full-css.js'),
          fileName: 'index',
          formats: ['es'],
        },
        rollupOptions,
      },
    };
  }

  // Library build configuration (original)
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/data-proxy': {
          // Default target - will be dynamically changed per-request
          target: 'https://example.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/data-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Forward the Authorization header
              if (req.headers['x-auth-token']) {
                proxyReq.setHeader(
                  'Authorization',
                  `Bearer ${req.headers['x-auth-token']}`,
                );
              }
            });
          },
        },
      },
    },
    build: {
      lib: {
        //eslint-disable-next-line no-undef
        entry: resolve(__dirname, 'src/index.js'),
        fileName: (format) => (format === 'cjs' ? 'index.cjs' : 'index.es.js'),
        formats: ['es', 'cjs'],
      },
      rollupOptions: rollupOptionsStrict,
    },
  };
});
