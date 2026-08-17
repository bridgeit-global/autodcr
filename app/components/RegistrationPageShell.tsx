import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";
import SiteFooter from "./SiteFooter";

type RegistrationPageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function RegistrationPageShell({
  title,
  description,
  children,
}: RegistrationPageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Back to Draft Desk home">
            <Image
              src="/draft-desk-logo.png"
              alt="Draft Desk"
              width={180}
              height={72}
              priority
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>
          <div className="hidden min-w-0 text-center sm:block">
            <p className="truncate text-sm font-semibold tracking-tight text-brand-navy md:text-base">
              {title}
            </p>
            {description ? (
              <p className="truncate text-xs text-gray-500">{description}</p>
            ) : null}
          </div>
          <Link
            href="/login"
            className="rounded-lg border border-brand-blue px-3 py-2 text-sm font-semibold text-brand-blue transition-all hover:bg-blue-50 sm:px-4"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
