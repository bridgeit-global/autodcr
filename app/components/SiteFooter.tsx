const SiteFooter = () => {
	return (
		<footer className="border-t border-gray-200 bg-white">
			<div className="mx-auto max-w-7xl px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-500">
				<div>© {new Date().getFullYear()} Online Building Plan Approval System</div>
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1">
						<span className="h-2 w-2 rounded-full bg-emerald-500" />
						<span>System Online</span>
					</span>
					<span className="text-gray-300">|</span>
					<span>Need help? Contact Help Desk</span>
				</div>
			</div>
		</footer>
	);
};

export default SiteFooter;

