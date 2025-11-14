type Tile = {
	title: string;
	items: string[];
	color: string;
};

type TileGridProps = {
	tiles: Tile[];
};

const TileGrid = ({ tiles }: TileGridProps) => {
	return (
		<section className="w-full bg-white py-6 ">
			<div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 md:grid-cols-5">
				{tiles.map((tile) => (
					<div key={tile.title} className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:bg-zinc-50">
						<div className={`${tile.color} px-4 py-3 text-white`}>
							<h4 className="text-sm font-semibold">{tile.title}</h4>
						</div>
						<ul className="space-y-2 px-4 py-3 text-sm">
							{tile.items.map((item) => (
								<li key={item} className="flex items-center gap-2 text-zinc-700">
									<span className="text-zinc-400">»</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</section>
	);
};

export type { Tile };
export default TileGrid;

