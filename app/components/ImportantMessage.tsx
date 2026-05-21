import { TEXT_BODY, TEXT_CAPTION } from "@/app/utils/typography";

type ImportantMessageProps = {
	message: string;
};

const ImportantMessage = ({ message }: ImportantMessageProps) => {
	return (
		<div className="w-full border-b border-gray-200 bg-gray-100 px-4 py-3 md:px-6">
			<div className="mx-auto max-w-7xl">
				<div className="flex items-center gap-2 rounded-md border-l-4 border-red-500 bg-red-50 px-4 py-3 shadow-sm">
					<span className={`shrink-0 font-semibold text-red-800 ${TEXT_BODY}`}>Important Message —</span>
					<div className="marquee-wrapper min-w-0 flex-1">
						<div className={`marquee-content text-red-700 ${TEXT_BODY}`}>
							<span>{message}</span>
							<span>{message}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ImportantMessage;
