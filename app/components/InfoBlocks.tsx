'use client';

import { useState } from "react";

type SystemUpdate = {
	date: string;
	note: string;
};

type ReformInfo = {
	overallTitle: string;
	illustrationLabel: string;
	reformTitle: string;
	points: string[];
};

type DepartmentLink = {
	label: string;
	href: string;
};

type Notification = {
	title: string;
	desc: string;
	isNew?: boolean;
};

type InfoBlocksProps = {
	systemUpdates: SystemUpdate[];
	reformInfo: ReformInfo;
	departmentLinks: DepartmentLink[];
	notifications: Notification[];
};

const InfoBlocks = ({ systemUpdates, reformInfo, departmentLinks, notifications }: InfoBlocksProps) => {
	const [openUpdate, setOpenUpdate] = useState(0);

	return (
		<section className="w-full bg-white pb-12">
			<div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 md:grid-cols-4">
				<div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:bg-zinc-50">
					<div className="border-b border-zinc-100 bg-sky-800 px-4 py-3">
						<h4 className="text-sm font-semibold uppercase tracking-wide text-white">System Updates</h4>
					</div>
					<ul className="flex flex-1 flex-col divide-y divide-zinc-100">
						{systemUpdates.map((item, idx) => {
							const isOpen = openUpdate === idx;
							return (
								<li key={item.date} className="flex flex-col">
									<button
										type="button"
										onClick={() => setOpenUpdate(isOpen ? -1 : idx)}
										className="flex items-center gap-3 px-4 py-3 text-left hover:bg-sky-50 focus:bg-sky-50 focus:outline-none"
									>
										<span className={`text-lg font-semibold text-sky-600 transition-transform ${isOpen ? "rotate-180" : ""}`}>
											▾
										</span>
										<div>
											<span className="block text-xs font-semibold uppercase tracking-wide text-sky-700">
												{item.date}
											</span>
										</div>
									</button>
									{isOpen && (
										<div className="px-4 pb-4 text-sm text-zinc-700">
											{item.note}
										</div>
									)}
								</li>
							);
						})}
					</ul>
				</div>

				<div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:bg-zinc-50">
					<div className="border-b border-zinc-100 bg-sky-800 px-4 py-3">
						<h4 className="text-sm font-semibold uppercase tracking-wide text-white">Reforms</h4>
					</div>
					<div className="flex flex-1 flex-col gap-3 px-4 py-4 text-sm text-zinc-700">
						<p className="text-zinc-600">{reformInfo.overallTitle}</p>
						<div className="rounded-xl border border-zinc-200 bg-sky-50 p-4 text-center text-xs uppercase tracking-wide text-sky-700">
							{reformInfo.illustrationLabel}
						</div>
						<p>{reformInfo.reformTitle}</p>
						<ul className="space-y-2 text-sm text-zinc-600">
							{reformInfo.points.map((point) => (
								<li key={point}>• {point}</li>
							))}
						</ul>
					</div>
				</div>

				<div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:bg-zinc-50">
					<div className="border-b border-zinc-100 bg-sky-800 px-4 py-3">
						<h4 className="text-sm font-semibold uppercase tracking-wide text-white">Related Departments</h4>
					</div>
					<ul className="flex flex-1 flex-col divide-y divide-zinc-100 text-sm">
						{departmentLinks.map((dept) => (
							<li key={dept.label} className="flex items-center justify-between px-4 py-3">
								<a href={dept.href} className="text-sky-700 hover:underline">
									{dept.label}
								</a>
								<span className="text-sky-500">↗</span>
							</li>
						))}
					</ul>
				</div>

				<div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:bg-zinc-50">
					<div className="border-b border-zinc-100 bg-sky-800 px-4 py-3">
						<h4 className="text-sm font-semibold uppercase tracking-wide text-white">Important Notifications</h4>
					</div>
					<ul className="flex flex-1 flex-col divide-y divide-zinc-100 text-sm">
						{notifications.map((notice) => (
							<li key={notice.title} className="flex flex-col gap-1 px-4 py-3">
								<div className="flex items-center gap-2">
									<span className="text-sm font-semibold text-zinc-800">{notice.title}</span>
									{notice.isNew && (
										<span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
											New
										</span>
									)}
								</div>
								<span className="text-sm text-zinc-600">{notice.desc}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
};

export type { SystemUpdate, ReformInfo, DepartmentLink, Notification };
export default InfoBlocks;

