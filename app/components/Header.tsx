'use client';

import Image from "next/image";

const Header = () => {
	return (
		<header className="w-full border-b border-zinc-200">
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
				<div className="flex items-center gap-3">
					<div className="h-12 w-12 overflow-hidden rounded-full border border-zinc-200 bg-white">
						<Image src="/vercel.svg" alt="Logo" width={48} height={48} className="object-contain p-2" />
					</div>
					<div>
						<p className="text-sm text-zinc-600">बृहन्मुंबई महानगरपालिका</p>
						<p className="text-xs text-zinc-500">BRIHANMUMBAI MUNICIPAL CORPORATION</p>
					</div>
				</div>
				<h1 className="text-center text-lg font-semibold sm:text-2xl">Online Building Plan Approval System</h1>
				<div className="flex items-center">
					<button className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-white shadow hover:bg-rose-600">
						<span className="inline-block h-2 w-2 rounded-full bg-white" />
						<span className="text-sm font-medium">Steps to Submit Plan</span>
					</button>
				</div>
			</div>
			<nav className="w-full bg-sky-900 text-white">
				<ul className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
					<li className="cursor-pointer hover:underline">Home</li>
					<li className="cursor-pointer hover:underline">About Us</li>
					<li className="cursor-pointer hover:underline">FAQs</li>
					<li className="cursor-pointer hover:underline">Circulars</li>
					<li className="cursor-pointer hover:underline">Downloads & Manuals</li>
					<li className="cursor-pointer hover:underline">Related Links</li>
					<li className="cursor-pointer hover:underline">DP Remarks</li>
					<li className="cursor-pointer hover:underline">Fee Calculator</li>
					<li className="cursor-pointer hover:underline">Gallery</li>
					<li className="cursor-pointer hover:underline">Contact Us</li>
				</ul>
			</nav>
		</header>
	);
};

export default Header;

