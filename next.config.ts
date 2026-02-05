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
	serverExternalPackages: ['pkcs11js', 'usb'],
	// Exclude native modules from client-side bundling
	webpack: (config, { isServer }) => {
		if (!isServer) {
			// Exclude native modules from client bundle
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				path: false,
				crypto: false,
			};
		}
		return config;
	},
};

export default nextConfig;
