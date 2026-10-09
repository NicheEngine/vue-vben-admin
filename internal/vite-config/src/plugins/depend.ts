import type { PluginOption } from 'vite';

import type { DependTypes } from '@vben/depend-config';

import process from 'node:process';

import { colors, readPackageJSON } from '@vben/node-utils';

interface PluginOptions {
  depends: Record<DependTypes, () => void>;
  root: string;
}

/**
 * 用于将配置文件抽离出来并注入到项目中
 * @returns
 */

async function viteBuildAppConfigPlugin({
  root = process.cwd(),
  depends,
}: PluginOptions): Promise<PluginOption | undefined> {
  const { name = '' } = await readPackageJSON(root);
  return {
    name: 'vite:depend-app-config-plugin',
    enforce: 'post',
    buildEnd: (error: any) => {
      appDependScriptsHandle(depends);
      if (error) {
        console.log(colors.red(`\nvite build error: \n${error}`));
      } else {
        console.log(`\n✨ ${colors.cyan(`[${name}]`)} - build successfully!`);
      }
    },
  };
}

const appDependScriptsHandle = (depends: Record<DependTypes, () => void>) => {
  if (depends && Object.entries(depends).length > 0) {
    for (const [depend, script] of Object.entries(depends)) {
      try {
        script();
        console.log(
          `\n✨ ${colors.cyan(`[${depend}]`)} - script run successfully!`,
        );
      } catch (scriptError) {
        console.log(
          `\n✨ ${colors.cyan(`[${depend}]`)} ${colors.red(`\nscript run with error: \n'${scriptError}`)}`,
        );
      }
    }
  }
};

async function viteServeAppConfigPlugin({
  depends,
}: PluginOptions): Promise<PluginOption | undefined> {
  return {
    name: 'vite:serve-app-config-plugin',
    enforce: 'pre',
    configureServer() {
      appDependScriptsHandle(depends);
    },
  };
}

export { viteBuildAppConfigPlugin, viteServeAppConfigPlugin };
