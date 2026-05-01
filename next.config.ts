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
	// Ensure non-imported template assets are bundled for serverless runtime (Vercel).
	// The HTML preview route reads templates via fs at runtime, so we must opt them into tracing.
	outputFileTracingIncludes: {
		"/api/application-preview-html": ["./appointment letter (Architect Licensed Surveyor).html"],
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
