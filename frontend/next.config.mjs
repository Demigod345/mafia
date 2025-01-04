/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { webpack }) => {
        config.experiments = { ...config.experiments, topLevelAwait: true };
        config.externals["node:fs"] = "commonjs node:fs";
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
      };
        config.plugins.push(
  
          new webpack.NormalModuleReplacementPlugin(
            /^node:/,
            (resource) => {
              resource.request = resource.request.replace(/^node:/, '');
            },
          ),
        );
    
        return config;
     },
     async headers() {
      return [
        {
          source: "/api/:path*",
          headers: [
            { key: "Access-Control-Allow-Credentials", value: "true" },
            { key: "Access-Control-Allow-Origin", value: "*" }, // replace this your actual origin
            { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
            { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ],
        },
      ]
     },
     images: {
      domains: ['cdn.dorahacks.io'],
    },
};

export default nextConfig;
