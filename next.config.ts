import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Allow HMR /_next/* when opening the dev app via LAN IP (not only localhost).
	// Add more entries if your machine gets a different IP on another network.
	allowedDevOrigins: ["192.168.1.*"],
	// Keep Chromium out of the webpack bundle so `bin/*.br` resolve from node_modules on Vercel.
	serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "pdf-parse"],
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
	// Turbopack configuration - empty config to silence the warning
	// The dynamic import with ssr: false in RegistrationForm handles the canvas module issue
	turbopack: {},
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
