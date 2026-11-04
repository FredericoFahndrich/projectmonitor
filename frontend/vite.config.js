import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({mode})=>({base:loadEnv(mode,process.cwd(),'').VITE_BASE_PATH || '/',server:{host:'127.0.0.1'},build:{target:'es2022'}}));
