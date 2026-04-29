import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
	// Server-only modules configuration - prevents bundling native modules
	// and keeps Chromium binaries at expected runtime paths on Vercel.
	serverExternalPackages: ['pkcs11js', 'usb', '@sparticuz/chromium', 'puppeteer-core'],
	// Ensure Chromium binary assets are traced into serverless output on Vercel.
	outputFileTracingIncludes: {
		"/api/application-preview-html": [
			"./node_modules/@sparticuz/chromium/**",
		],
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
