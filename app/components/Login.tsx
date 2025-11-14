"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import ForgotPasswordModal from "./ForgotPasswordModal"; // <-- IMPORT MODAL
import ForgetUsernameModal from "./ForgetUsernameModal";

type HeroSectionProps = {
	slides: string[];
};

const HeroSection = ({ slides }: HeroSectionProps) => {
	const [currentSlide, setCurrentSlide] = useState(0);

	// ⭐ NEW: modal state
	const [forgotOpen, setForgotOpen] = useState(false);
	const [userforgotOpen, setUserForgotOpen] = useState(false);


	const goToPrev = () => {
		setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
	};

	const goToNext = () => {
		setCurrentSlide((prev) => (prev + 1) % slides.length);
	};

	useEffect(() => {
		const id = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % slides.length);
		}, 10000);
		return () => clearInterval(id);
	}, [slides.length]);

	return (
		<>
			{/* ⭐ MODAL AT TOP LEVEL */}
			<ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
			<ForgetUsernameModal open={userforgotOpen} onClose={() => setUserForgotOpen(false)} />


			<section
				className="relative w-full border-b border-zinc-200 bg-cover bg-center"
				style={{ backgroundImage: `url(${slides[currentSlide]})` }}
			>
				<div className="absolute inset-0 bg-sky-900/40" />

				{/* arrows */}
				<button
					type="button"
					onClick={goToPrev}
					className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-sky-700 shadow hover:bg-white"
				>
					<span className="inline-block rotate-180 text-2xl leading-none">&rsaquo;</span>
				</button>

				<button
					type="button"
					onClick={goToNext}
					className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-sky-700 shadow hover:bg-white"
				>
					<span className="inline-block text-2xl leading-none">&rsaquo;</span>
				</button>

				<div className="relative mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 py-8 text-white md:grid-cols-3 md:py-12">
					<div className="md:col-span-2">
						<div className="mb-4 inline-block rounded bg-sky-900 px-4 py-2">
							<h2 className="text-lg font-semibold tracking-wide">REFORMS UNDERTAKEN</h2>
						</div>
						<ul className="space-y-4 text-base leading-relaxed">
							{[
								"Single Window Clearance System for all types of approval",
								"Time bound approval system",
								"Construction life cycle approvals within 8 processes and time 45 days",
								"Integrated online approval system for issuing NOCs",
								"Fee calculator for knowing permit cost in advance",
								"Online payment facility",
							].map((item) => (
								<li key={item} className="flex items-start gap-3">
									<span className="mt-1 text-amber-300">🚧</span>
									<span className="text-white">{item}</span>
								</li>
							))}
						</ul>
					</div>

					{/* login card */}
					<div className="md:col-span-1 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),0_15px_30px_-8px_rgba(0,0,0,0.5)]">
						<div className="rounded-xl border border-sky-200 bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),0_15px_30px_-8px_rgba(0,0,0,0.5)]">
							<div className="bg-sky-700 px-4 py-3 text-white rounded-xl">
								<h3 className="text-base font-semibold">User Login</h3>
							</div>

							<div className="space-y-3 p-4 shadow-lg">
								<label className="block text-sm">
									<span className="mb-1 block text-zinc-700">Username</span>
									<input
										type="text"
										className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
										placeholder="Enter username"
									/>
								</label>

								<label className="block text-sm">
									<span className="mb-1 block text-zinc-700">Password</span>
									<input
										type="password"
										className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
										placeholder="Enter password"
									/>
								</label>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="h-12 w-40 select-none rounded border border-zinc-300 bg-zinc-50 p-2 text-center font-mono text-lg tracking-widest text-zinc-700">
											98•22
										</div>
										<button type="button" className="text-sm text-sky-700 underline">
											Generate New Image
										</button>
									</div>

									<input
										type="text"
										className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
										placeholder="Type the code from the image"
									/>
								</div>

                                {/* ⭐ Forgot Password Logic */}
								<div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
									<button className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 sm:w-auto">
										Login
									</button>
									<div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
									<button
										type="button"
										className="w-full rounded bg-sky-700 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-sky-800 sm:mx-2 sm:w-auto"
										onClick={() => setForgotOpen(true)} // ⭐ OPEN MODAL
									>
										Forgot Password
									</button>
									<button
										type="button"
										className="w-full rounded bg-sky-700 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-sky-800 sm:w-auto"
										onClick={() => setUserForgotOpen(true)} // ⭐ OPEN MODAL
									>
										Forgot Username 
									</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* slider dots */}
				<div className="absolute bottom-4 right-8 flex gap-2">
					{slides.map((_, idx) => (
						<span
							key={idx}
							className={`h-2.5 w-2.5 rounded-full ${
								idx === currentSlide ? "bg-white" : "bg-white/60"
							}`}
						/>
					))}
				</div>
			</section>
		</>
	);
};

export default HeroSection;
