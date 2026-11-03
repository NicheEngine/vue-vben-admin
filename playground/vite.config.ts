import type { UserConfig } from 'vite';

import type { ApplicationConfigOptions } from '@vben/vite-config';

import { defineConfig } from '@vben/vite-config';

import serverProxies from './proxies.config';

export default defineConfig(async (): Promise<ApplicationConfigOptions> => {
  return {
    application: {
      serverProxies,
      depend: true,
      dependOptions: {
        build: true,
        serve: true,
        depends: {
          jessibuca: {
            source: '../libraries/jessibuca',
          },
          cesium: true,
          easyplayer: true,
          tianditu: {
            source: '../libraries/tianditu',
          },
        },
      },
    },
    vite: {
      test: {
        globals: true, // 全局引入vitest位置
        environment: 'jsdom', // 环境选择 jsdom
        includeSource: ['src/**/*.{js,ts}'],
      },
    } as UserConfig,
  };
});
