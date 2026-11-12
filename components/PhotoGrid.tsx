"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Media } from "@/lib/types";

export default function PhotoGrid({ photos }: { photos: Media[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const client = createClient();
    Promise.all(photos.map(async (photo) => {
      const { data } = await client.storage.from("review-photos").createSignedUrl(photo.thumb_key ?? photo.storage_key, 3600);
      return [photo.id, data?.signedUrl ?? ""] as const;
    })).then((entries) => { if (active) setUrls(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [photos]);
  if (!photos.length) return null;
  return <>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.slice(0, 8).map((photo) => urls[photo.id] ? <button key={photo.id} type="button" onClick={() => setSelected(urls[photo.id])} className="aspect-[4/3] overflow-hidden rounded-sm bg-[var(--surface)]"><img src={urls[photo.id]} alt="Review photo" className="size-full object-cover transition-transform hover:scale-[1.03]" /></button> : <div key={photo.id} className="aspect-[4/3] animate-pulse bg-[var(--border)]" />)}</div>
    {selected && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setSelected(null)}><button type="button" aria-label="Close photo" className="absolute right-5 top-4 text-3xl text-white">&times;</button><img src={selected} alt="Review photo full size" className="max-h-[90vh] max-w-full object-contain" /></div>}
  </>;
}