import { Construction } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description?: string;
};

export default function ComingSoon({
  title,
  description = "This section is coming soon. We will add it step by step as the redesign continues.",
}: ComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
        <Construction className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-xl font-bold text-brand-navy">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{description}</p>
    </div>
  );
}
