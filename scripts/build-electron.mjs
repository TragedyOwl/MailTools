import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

const outdir = 'dist-electron';

await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: ['electron/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: `${outdir}/main.cjs`,
  external: ['electron'],
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
});
