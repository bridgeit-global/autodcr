type ImportantMessageProps = {
	message: string;
};

const ImportantMessage = ({ message }: ImportantMessageProps) => {
	return (
<div className="w-full border-b border-zinc-200 bg-white">
  <div className="mx-auto  px-4 py-2 text-xs text-red-600 font-bold flex items-center gap-2">
    
    <span>Important Message -</span>

    <div className="marquee-wrapper flex-1">
      <div className="marquee-content">
        <span>{message}</span>
        <span>{message}</span>
      </div>
    </div>

  </div>
</div>








	);
};

export default ImportantMessage;

