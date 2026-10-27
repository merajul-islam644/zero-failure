/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional on purpose: a fresh clone without .env must still compile, and
  // config.ts's isBlocksConfigured()/isLoginConfigured() guards are what
  // surface the gap at runtime.
  readonly VITE_BLOCKS_API_URL?: string;
  readonly VITE_BLOCKS_APP_DOMAIN?: string;
  readonly VITE_BLOCKS_OIDC_URL?: string;
  readonly VITE_BLOCKS_OIDC_CLIENT_ID?: string;
  readonly VITE_BLOCKS_OIDC_SCOPE?: string;
  readonly VITE_BLOCKS_X_BLOCKS_KEY?: string;
  readonly VITE_BLOCKS_DEV_HOST?: string;
  readonly VITE_BLOCKS_DEV_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
