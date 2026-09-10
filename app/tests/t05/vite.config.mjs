import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config.ts';
import { R1, R2 } from './fixtures.mjs';

// Only this test server substitutes imported data. Production config is untouched.
export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 't05-isolated-fixtures', enforce: 'post',
    transform(code, id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      if (path.endsWith('/public/data/records.json')) {
        return { code: `const cases = ${JSON.stringify({ normal: [R1, R2], reverse: [R2, R1], empty: [] })};
          const records = cases[new URLSearchParams(location.search).get('case')] || cases.normal;
          window.__T05_records = records;
          export default { records };`, map: null };
      }
      if (path.endsWith('/public/fixtures/normal-d1-a.json')) {
        return { code: code.replace(/normalized_value:\s*100|"normalized_value":\s*100/g, '"normalized_value": 999'), map: null };
      }
    },
  }],
  server: { host: '127.0.0.1', port: 5185, strictPort: true },
}));
