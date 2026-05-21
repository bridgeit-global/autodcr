'use client';

import { useState } from "react";
import { BTN_SAVE_UNSAVED, CARD_HEADER_GRADIENT } from "@/app/utils/buttonClasses";
import { TEXT_BODY, TEXT_CAPTION, TEXT_MUTED, TEXT_TITLE_CARD } from "@/app/utils/typography";

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
		<section className="w-full bg-gray-100 pb-12">
			<div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 md:grid-cols-4 md:px-6">
				<div className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
					<div className={`border-b border-gray-200 px-4 py-3 ${CARD_HEADER_GRADIENT}`}>
						<h4 className={`${TEXT_TITLE_CARD} uppercase tracking-wide text-white`}>System Updates</h4>
					</div>
					<ul className="flex flex-1 flex-col divide-y divide-gray-100">
						{systemUpdates.map((item, idx) => {
							const isOpen = openUpdate === idx;
							return (
								<li key={item.date} className="flex flex-col">
									<button
										type="button"
										onClick={() => setOpenUpdate(isOpen ? -1 : idx)}
										className="flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
									>
										<span className={`text-lg font-semibold text-emerald-600 transition-transform ${isOpen ? "rotate-180" : ""}`}>
											▾
										</span>
										<div>
											<span className="block text-xs font-semibold uppercase tracking-wide text-emerald-800">
												{item.date}
											</span>
										</div>
									</button>
									{isOpen && (
										<div className={`px-4 pb-4 ${TEXT_MUTED}`}>
											{item.note}
										</div>
									)}
								</li>
							);
						})}
					</ul>
				</div>

				<div className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
					<div className={`border-b border-gray-200 px-4 py-3 ${CARD_HEADER_GRADIENT}`}>
						<h4 className={`${TEXT_TITLE_CARD} uppercase tracking-wide text-white`}>Reforms</h4>
					</div>
					<div className={`flex flex-1 flex-col gap-3 px-4 py-4 ${TEXT_BODY}`}>
						<p className={TEXT_MUTED}>{reformInfo.overallTitle}</p>
						<div className={`rounded-xl border border-gray-200 bg-emerald-50 p-4 text-center uppercase tracking-wide text-emerald-800 ${TEXT_CAPTION}`}>
							{reformInfo.illustrationLabel}
						</div>
						<p>{reformInfo.reformTitle}</p>
						<ul className={`space-y-2 ${TEXT_MUTED}`}>
							{reformInfo.points.map((point) => (
								<li key={point}>• {point}</li>
							))}
						</ul>
					</div>
				</div>

				<div className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
					<div className={`border-b border-gray-200 px-4 py-3 ${CARD_HEADER_GRADIENT}`}>
						<h4 className={`${TEXT_TITLE_CARD} uppercase tracking-wide text-white`}>Related Departments</h4>
					</div>
					<ul className={`flex flex-1 flex-col divide-y divide-gray-100 ${TEXT_BODY}`}>
						{departmentLinks.map((dept) => (
							<li key={dept.label} className="flex items-center justify-between px-4 py-3">
								<a href={dept.href} className="text-emerald-700 hover:underline">
									{dept.label}
								</a>
								<span className="text-emerald-500">↗</span>
							</li>
						))}
					</ul>
				</div>

				<div className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
					<div className={`border-b border-gray-200 px-4 py-3 ${CARD_HEADER_GRADIENT}`}>
						<h4 className={`${TEXT_TITLE_CARD} uppercase tracking-wide text-white`}>Important Notifications</h4>
					</div>
					<ul className={`flex flex-1 flex-col divide-y divide-gray-100 ${TEXT_BODY}`}>
						{notifications.map((notice) => (
							<li key={notice.title} className="flex flex-col gap-1 px-4 py-3">
								<div className="flex items-center gap-2">
									<span className={`font-semibold ${TEXT_BODY}`}>{notice.title}</span>
									{notice.isNew && (
										<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${BTN_SAVE_UNSAVED}`}>
											New
										</span>
									)}
								</div>
								<span className={TEXT_MUTED}>{notice.desc}</span>
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

