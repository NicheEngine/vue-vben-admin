/// <reference types="vite/client" />

import type { JessibucaInstance } from './types';

/**
 * Jessibuca 全局类型声明
 * ...
 */
declare global {
  interface Window {
    /** Jessibuca 全局构造器 */
    Jessibuca: new (options: Record<string, any>) => JessibucaInstance;
  }
}
// oxlint-disable-next-line unicorn/require-module-specifiers
export type {};
