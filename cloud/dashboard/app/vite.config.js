import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './', // Assure la compatibilité des chemins lors du build
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@js': resolve(__dirname, './src/js'),
      '@css': resolve(__dirname, './src/css'),
    },
  },
  server: {
    host: true, // Permet d'accéder au dashboard depuis un téléphone sur le même WiFi
    port: 5173,
    open: true, // Ouvre le navigateur automatiquement
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        admin: resolve(__dirname, 'dashboards/admin.html'),
        industrie: resolve(__dirname, 'dashboards/industrie.html'),
        exploitant: resolve(__dirname, 'dashboards/exploitant.html')
      }
    }
  }
});
