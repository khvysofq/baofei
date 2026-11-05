import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 单机部署：产出 .next/standalone，复制即可运行，不需要在服务器上安装依赖。 */
  output: "standalone",
  /* PGlite 带 WASM 与文件系统访问，不能被打包进服务端 bundle，保持外部依赖。 */
  serverExternalPackages: ["@electric-sql/pglite"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;