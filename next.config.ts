import type { NextConfig } from "next";
import path from "path";

const projectRoot = path.join(__dirname);

const nextConfig: NextConfig = {
	// Allow HMR /_next/* when opening the dev app via LAN IP (not only localhost).
	// Add more entries if your machine gets a different IP on another network.
	allowedDevOrigins: ["192.168.1.*"],
	transpilePackages: [
		"@mlightcad/cad-simple-viewer",
		"@mlightcad/data-model",
		"@mlightcad/libredwg-converter",
		"@mlightcad/libredwg-web",
		"@mlightcad/mtext-renderer",
		"@mlightcad/three-renderer",
		"@mlightcad/geometry-engine",
		"@mlightcad/graphic-interface",
		"@mlightcad/common",
		"three",
		"lodash-es",
	],
	// Keep Chromium out of the webpack bundle so `bin/*.br` resolve from node_modules on Vercel.
	serverExternalPackages: [
		"@sparticuz/chromium",
		"puppeteer-core",
		"pdf-parse",
		"@pinecone-database/pinecone",
	],
	experimental: {
		serverActions: {
			bodySizeLimit: "25mb",
		},
		// Local/proxy only. Vercel Functions still reject bodies over 4.5 MB (HTTP 413).
		proxyClientMaxBodySize: "25mb",
	},
	// @sparticuz/chromium binary must be explicitly included so Vercel's file-tracing
	// bundles it into the serverless function — otherwise the binary is missing and
	// puppeteer.launch() throws "spawn ETXTBSY".
	// Note: moved from experimental.outputFileTracingIncludes (Next.js 15) to top-level (Next.js 16).
	outputFileTracingIncludes: {
		"/api/application-preview-pdf": [
			"./node_modules/@sparticuz/chromium/**",
			"./node_modules/@sparticuz/chromium/bin/**",
			"./public/pagedjs/**",
		],
		"/api/application-preview-html": ["./html/**"],
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
		],
	},
	// Pin the workspace to this repo so a stray ~/package-lock.json is not treated as the root.
	outputFileTracingRoot: projectRoot,
	// The dynamic import with ssr: false in RegistrationForm handles the canvas module issue
	turbopack: {
		root: projectRoot,
	},
	// Exclude native modules from client-side bundling
	webpack: (config, { isServer }) => {
		config.resolve.alias = {
			...(config.resolve.alias || {}),
			canvas: false,
		};

		if (!isServer) {
			// Exclude native modules from client bundle
			config.resolve.fallback = {
				...config.resolve.fallback,
				canvas: false,
				fs: false,
				path: false,
				crypto: false,
			};
		}
		return config;
	},
};

export default nextConfig;
