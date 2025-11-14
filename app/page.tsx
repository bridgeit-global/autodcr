'use client';

import Header from "./components/Header";
import HeroSection from "./components/Login";
import ImportantMessage from "./components/ImportantMessage";
import InfoBlocks, {
	DepartmentLink,
	Notification,
	ReformInfo,
	SystemUpdate,
} from "./components/InfoBlocks";
import TileGrid, { Tile } from "./components/TileGrid";
import VideoGallery, { VideoItem } from "./components/VideoGallery";
import SiteFooter from "./components/SiteFooter";

const SLIDES = [
	"https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920&auto=format&fit=crop",
	"https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?q=80&w=1920&auto=format&fit=crop",
	"https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1920&auto=format&fit=crop",
	"https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1920&auto=format&fit=crop",
];

const IMPORTANT_MESSAGE = "This is some random necessary message that u can take necessary or just ignore it.This is some random necessary message that u can take necessary or just ignore it.This is some random necessary message that u can take necessary or just ignore it.";

const TILES: Tile[] = [
	{
		title: "DASHBOARDS",
		items: ["Proposal Summary", "SWM Summary"],
		color: "bg-amber-700",
	},
	{
		title: "PAYMENT",
		items: ["Online Payment", "Payment through Credit Note"],
		color: "bg-green-700",
	},
	{
		title: "CITIZEN SEARCH",
		items: ["For Citizens"],
		color: "bg-teal-700",
	},
	{
		title: "SEARCH",
		items: ["Consultant", "Developer"],
		color: "bg-sky-700",
	},
	{
		title: "REGISTRATION",
		items: ["Developer/Owner/User", "Department", "BMC Contractors"],
		color: "bg-indigo-800",
	},
];

const SYSTEM_UPDATES: SystemUpdate[] = [
	{
		date: "30-Oct-2025",
		note: "New Feature Added – Project Search by Society Name on Citizen Search.",
	},
	{ date: "12-June-2025", note: "Citizen dashboard enhancements deployed." },
	{ date: "20-May-2025", note: "Integration with MPCB portal completed." },
	{ date: "10-May-2025", note: "Infrastructure maintenance window announced." },
	{ date: "10-Apr-2025", note: "General stability improvements." },
];

const REFORM_INFO: ReformInfo = {
	overallTitle: "Overall Processes",
	illustrationLabel: "Process Flow Illustration",
	reformTitle: "Process Reform",
	points: ["Simplified scrutiny stages", "Automated document validation", "Real-time status tracking"],
};

const DEPARTMENT_LINKS: DepartmentLink[] = [
	{ label: "Maharashtra Pollution Control Board (MPCB)", href: "#" },
	{ label: "Airport Authority of India (AAI)", href: "#" },
	{ label: "National Monuments Authority (NMA)", href: "#" },
	{ label: "Western Railway", href: "#" },
];

const NOTIFICATIONS: Notification[] = [
	{
		title: "Application Form Format :: Annexure A",
		desc: "To be made by the Project Proponent on his letter head for urgent pre-monsoon permissions.",
		isNew: true,
	},
	{
		title: "Travel Pass Format",
		desc: "Updated guidelines for onsite inspection visits.",
		isNew: true,
	},
	{
		title: "Digitally signed PRC available",
		desc: "Authentic map verification during submission is now live.",
		isNew: false,
	},
];

const VIDEOS: VideoItem[] = [
	{
		title: "Mumbai Skyline",
		image: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?q=80&w=800&auto=format&fit=crop",
		videoUrl: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
	},
	{
		title: "Chhatrapati Shivaji Maharaj Terminus",
		image: "https://images.unsplash.com/photo-1602344926332-1daca235ae81?q=80&w=800&auto=format&fit=crop",
		videoUrl: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
	},
	{
		title: "Marine Drive",
		image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=800&auto=format&fit=crop",
		videoUrl: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
	},
];

export default function Home() {
	return (
		<div className="min-h-screen bg-white/90 text-zinc-900 backdrop-blur-sm">
			<Header />
			<main>
				<HeroSection slides={SLIDES} />
				<ImportantMessage message={IMPORTANT_MESSAGE} />
				<TileGrid tiles={TILES} />
				<InfoBlocks
					systemUpdates={SYSTEM_UPDATES}
					reformInfo={REFORM_INFO}
					departmentLinks={DEPARTMENT_LINKS}
					notifications={NOTIFICATIONS}
				/>
				<VideoGallery videos={VIDEOS} />
			</main>
			<SiteFooter />
		</div>
	);
}
