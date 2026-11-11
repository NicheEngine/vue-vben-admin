/// <reference types="vite/client" />

/** 项目相关的环境变量声明 */
export interface EngineAmapConfigRaw {
  VITE_AMAP_API_MOUSE_TOOL: string;
  VITE_AMAP_API_PLUGINS: string;
  VITE_AMAP_API_PROVIDE: string;
  VITE_AMAP_API_VERSION: string;
  VITE_AMAP_SECRET_KEY: string;
  VITE_AMAP_SECURITY_CODE: string;
  VITE_AMAP_UI_ENABLED: string;
  VITE_AMAP_UI_PLUGINS: string;
  VITE_AMAP_UI_VERSION: string;
}

declare global {
  /**
   * 直接声明 ImportMetaEnv，只覆盖项目专属环境变量。
   * 这样既避免了 `&` 交叉类型引发的 any 检查，也避开了空 `{}` 接口的 lint。
   */
  interface ImportMetaEnv {
    readonly VITE_AMAP_API_MOUSE_TOOL: string;
    readonly VITE_AMAP_API_PLUGINS: string;
    readonly VITE_AMAP_API_PROVIDE: string;
    readonly VITE_AMAP_API_VERSION: string;
    readonly VITE_AMAP_SECRET_KEY: string;
    readonly VITE_AMAP_SECURITY_CODE: string;
    readonly VITE_AMAP_UI_ENABLED: string;
    readonly VITE_AMAP_UI_PLUGINS: string;
    readonly VITE_AMAP_UI_VERSION: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    _AMapSecurityConfig: {
      securityJsCode: string;
    };
    AMap: any;
    AMapUI: any;
  }
}
