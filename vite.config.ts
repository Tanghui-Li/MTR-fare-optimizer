import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (
            normalizedId.includes('/node_modules/leaflet/')
          ) {
            return 'leaflet';
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react';
          }

          if (
            normalizedId.endsWith('/src/fare_matrix.json') ||
            normalizedId.includes('/opendata/light_rail_fares.csv') ||
            normalizedId.includes('/opendata/mtr_lines_fares.csv')
          ) {
            return 'fare-data';
          }

          if (normalizedId.includes('/opendata/')) {
            return 'opendata';
          }

          if (
            normalizedId.includes('/src/data/') ||
            normalizedId.endsWith('/src/lines.json') ||
            normalizedId.endsWith('/src/stations.json')
          ) {
            return 'transit-static';
          }
        },
      },
    },
  },
})
