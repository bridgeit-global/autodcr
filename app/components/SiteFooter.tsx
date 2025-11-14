const SiteFooter = () => {
	return (
		<footer className="border-t border-zinc-200 bg-zinc-50">
			<div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-zinc-500">
				© {new Date().getFullYear()} Online Building Plan Approval System
			</div>
		</footer>
	);
};

export default SiteFooter;

