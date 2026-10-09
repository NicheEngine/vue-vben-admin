import type { ProxyOptions } from 'vite';

import * as http from 'node:http';
import * as https from 'node:https';

import { colors } from '@vben/node-utils';

type ExtendProxyOptions = Omit<ProxyOptions, 'rewrite'> & {
  rewrite?: ((path: string) => string) | boolean;
};

export interface ServerProxy extends ExtendProxyOptions {
  prefix?: string;
  rewrite?: ((path: string) => string) | boolean;
  target: string;
}

export type ServerProxies = Record<string, ServerProxy>;

const httpsMatches = /^https:\/\//;

async function createProxy(serverProxies: ServerProxies) {
  const serverProxy: Record<string, ProxyOptions> = {};

  for (const [key, proxy] of Object.entries(serverProxies)) {
    if (!proxy || !key) {
      continue;
    }
    const target = proxy.target;
    const isHttps = httpsMatches.test(target);

    const prefix = proxy?.prefix ?? `/${key}`;

    const rewrite = (path: string) => {
      return path.replace(new RegExp(`^${prefix}`), '');
    };

    function ofProxyRewrite() {
      if (proxy?.rewrite === undefined) {
        return (path: string) => path;
      }
      if (typeof proxy?.rewrite === 'function') {
        return proxy?.rewrite;
      } else if (typeof proxy?.rewrite === 'boolean') {
        return rewrite;
      } else {
        return (path: string) => path;
      }
    }

    function ofProxyAgent() {
      if (proxy?.agent === undefined) {
        return undefined;
      }
      return proxy?.agent === 'https' && isHttps
        ? new https.Agent()
        : new http.Agent();
    }

    // https://github.com/http-party/node-http-proxy#options
    serverProxy[prefix] = {
      // exp: http://127.0.0.1:8080
      target,
      // 表示开启代理, 允许跨域请求数据
      changeOrigin: proxy?.changeOrigin ?? true,
      // ws 默认开启支持
      ws: proxy?.ws ?? true,
      agent: ofProxyAgent(),
      rewrite: ofProxyRewrite(),
      // 如果是https接口，需要配置这个参数
      ...(isHttps ? { secure: false } : {}),
    };
    console.log(
      `\n✨ ${colors.cyan(`[${key}]`)}: ${colors.green(`[${target}]`)} - proxy config successfully!`,
    );
  }
  return serverProxy;
}

export { createProxy };
