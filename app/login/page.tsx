"use client";

import { Suspense } from "react";
import Login from "../components/Login";

const SLIDES = [
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1920&auto=format&fit=crop",
];

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-0 h-[100dvh] max-h-[100dvh] overflow-hidden supports-[height:100svh]:h-[100svh] supports-[height:100svh]:max-h-[100svh] md:static md:inset-auto md:h-dvh md:max-h-dvh">
      <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-white">Loading...</div>}>
        <Login slides={SLIDES} />
      </Suspense>
    </div>
  );
}
