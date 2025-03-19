/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	images: {
		domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
	},
	async rewrites() {
		return [
			{
				source: '/api/v1/:path*',
				destination: 'http://localhost:8000/api/v1/:path*',
			},
		];
	},
};

export default nextConfig; 