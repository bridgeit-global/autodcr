'use client';

import Image from "next/image";
import { BTN_PRIMARY, NAV_BAR_GRADIENT } from "@/app/utils/buttonClasses";
import { TEXT_BRAND, TEXT_CAPTION, TEXT_NAV, TEXT_TITLE_MD } from "@/app/utils/typography";

const Header = () => {
	return (
		<header className="w-full bg-gray-100">
			<div className="px-4 py-4 md:px-6">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-3xl border border-gray-200 bg-white px-4 py-4 shadow-sm md:px-6">
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
							<Image src="/vercel.svg" alt="Logo" width={48} height={48} className="object-contain p-2" />
						</div>
						<div>
							<p className={TEXT_BRAND}>बृहन्मुंबई महानगरपालिका</p>
							<p className={TEXT_CAPTION}>BRIHANMUMBAI MUNICIPAL CORPORATION</p>
						</div>
					</div>
					<h1 className={`hidden text-center sm:block ${TEXT_TITLE_MD}`}>
						Online Building Plan Approval System
					</h1>
					<div className="flex items-center">
						<button
							type="button"
							className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}
						>
							<span className="inline-block h-2 w-2 rounded-full bg-white" />
							<span>Steps to Submit Plan</span>
						</button>
					</div>
				</div>
			</div>
			<nav className={`w-full ${NAV_BAR_GRADIENT}`}>
				<ul className={`mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 md:px-6 ${TEXT_NAV}`}>
					{[
						"Home",
						"About Us",
						"FAQs",
						"Circulars",
						"Downloads & Manuals",
						"Related Links",
						"DP Remarks",
						"Fee Calculator",
						"Gallery",
						"Contact Us",
					].map((label) => (
						<li key={label} className="cursor-pointer transition-opacity hover:opacity-90 hover:underline">
							{label}
						</li>
					))}
				</ul>
			</nav>
		</header>
	);
};

export default Header;
