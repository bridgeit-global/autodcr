'use client';

import Image from "next/image";
import { useState } from "react";

type VideoItem = {
	title: string;
	image: string;
	videoUrl: string;
};

type VideoGalleryProps = {
	videos: VideoItem[];
};

const VideoGallery = ({ videos }: VideoGalleryProps) => {
	const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

	return (
		<>
			<section className="w-full bg-linear-to-b from-sky-200 via-sky-300 to-sky-400 py-12">
				<div className="mx-auto max-w-7xl px-4">
					<h2 className="mb-8 text-center text-2xl font-bold uppercase tracking-wide text-white">Video Gallery</h2>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						{videos.map((video) => (
							<div
								key={video.title}
								className="relative overflow-hidden rounded-xl border-4 border-white shadow-lg"
								style={{ minHeight: "220px" }}
							>
								{selectedVideo?.title === video.title ? (
									<div className="relative flex h-full flex-col bg-black">
										<button
											type="button"
											className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black transition hover:bg-white"
											onClick={() => setSelectedVideo(null)}
											aria-label="Close video"
										>
											✕
										</button>
										<video controls autoPlay className="aspect-video w-full object-cover">
											<source src={video.videoUrl} type="video/mp4" />
											Your browser does not support the video tag.
										</video>
										<div className="bg-black/70 px-4 py-3 text-sm font-medium uppercase tracking-wide text-white">
											{video.title}
										</div>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setSelectedVideo(video)}
										className="group relative flex h-full w-full flex-col items-center justify-center gap-4 focus:outline-none"
									>
										<span className="absolute inset-0">
											<Image
												src={video.image}
												alt={video.title}
												fill
												className="object-cover transition-transform duration-300 group-hover:scale-105"
											/>
										</span>
										<span className="absolute inset-0 bg-sky-900/20 group-hover:bg-sky-900/30" />
										<span className="relative flex h-full flex-col items-center justify-center gap-4">
											<span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-transform duration-200 group-hover:scale-105">
												▶
											</span>
											<span className="text-lg font-semibold uppercase tracking-wide text-white drop-shadow">{video.title}</span>
										</span>
									</button>
								)}
							</div>
						))}
					</div>
				</div>
			</section>
		</>
	);
};

export type { VideoItem };
export default VideoGallery;