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
};

export default nextConfig;
