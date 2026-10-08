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
  type ImportMetaEnv = EngineAmapConfigRaw;
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
