"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { attachMedia, getTags, identifySubject, saveReview, updateSubjectDetails } from "@/lib/actions";
import PhotoGrid from "@/components/PhotoGrid";
import StarRating from "@/components/StarRating";
import TagChip from "@/components/TagChip";
import { createClient } from "@/lib/supabase/client";
import { normalizeAirbnbUrl } from "@/lib/normalize";
import type { Media, Review, Subject, SubjectKind, Tag } from "@/lib/types";

type ExistingTag = { id: number; label: string; note: string | null };
type PhotoDraft = { id: string; blob: Blob; width: number; height: number; preview: string };
const kinds: { value: SubjectKind; label: string }[] = [{ value: "stay", label: "Stay" }, { value: "hotel", label: "Hotel" }, { value: "restaurant", label: "Restaurant" }, { value: "bar", label: "Bar" }];

async function compressPhoto(file: File): Promise<Omit<PhotoDraft, "id" | "preview">> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process this photo.");
  context.drawImage(image, 0, 0, width, height); image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not compress this photo.")), "image/jpeg", 0.8));
  return { blob, width, height };
}

export default function WriteForm({ input = "", initialSubject, initialReview, initialReviewTags = [], initialMedia = [] }: { input?: string; initialSubject?: Subject; initialReview?: Review; initialReviewTags?: ExistingTag[]; initialMedia?: Media[] }) {
  const [step, setStep] = useState(initialSubject ? 2 : 1);
  const [kind, setKind] = useState<SubjectKind>(initialSubject?.kind ?? (normalizeAirbnbUrl(input) ? "stay" : "restaurant"));
  const [name, setName] = useState(input || initialSubject?.display_name || "");
  const [address, setAddress] = useState(initialSubject?.address ?? "");
  const [city, setCity] = useState(initialSubject?.city ?? "");
  const [subject, setSubject] = useState<Subject | undefined>(initialSubject);
  const [candidate, setCandidate] = useState<Subject | null>(null);
  const [hostName, setHostName] = useState(initialSubject?.host_name ?? "");
  const [hostUsername, setHostUsername] = useState(initialSubject?.host_username ?? "");
  const [placeType, setPlaceType] = useState<"whole" | "private" | "shared" | "">(initialSubject?.place_type ?? "");
  const [priceTier, setPriceTier] = useState<number | null>(initialSubject?.price_tier ?? null);
  const [rating, setRating] = useState(initialReview?.rating ?? -1);
  const [body, setBody] = useState(initialReview?.body ?? "");
  const [visitDate, setVisitDate] = useState(initialReview?.visit_date ?? "");
  const [stayStart, setStayStart] = useState(initialReview?.stay_start ?? "");
  const [stayEnd, setStayEnd] = useState(initialReview?.stay_end ?? "");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Record<number, string>>(() => Object.fromEntries(initialReviewTags.map((tag) => [tag.id, tag.note ?? ""])));
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherLabel, setOtherLabel] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const previewUrls = useRef<string[]>([]);
  const [message, setMessage] = useState("");
  const [duplicateReviewId, setDuplicateReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (step === 5 && subject) getTags(subject.kind).then((result) => { setAvailableTags(result.tags); if (result.error) setMessage(result.error); });
  }, [step, subject]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function identify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setCandidate(null);
    const result = await identifySubject({ kind, name, address, city });
    setBusy(false);
    if (result.error) { setMessage(result.error); return; }
    if (result.candidate) { setCandidate(result.candidate); return; }
    setSubject(result.subject); setKind(result.subject.kind); setCity(result.subject.city ?? city); setAddress(result.subject.address ?? address); setStep(2);
  }

  async function nextFromDetails() {
    if (!subject) return;
    setBusy(true); setMessage("");
    const result = await updateSubjectDetails({ subjectId: subject.id, kind: subject.kind, hostName, hostUsername, city, placeType, priceTier });
    setBusy(false);
    if (result.error) { setMessage(result.error); return; }
    setStep(3);
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setBusy(true); setMessage("");
    const remaining = Math.max(0, 8 - initialMedia.length - photos.length);
    try {
      const additions = await Promise.all(Array.from(files).slice(0, remaining).map(async (file) => {
        const compressed = await compressPhoto(file);
        const preview = URL.createObjectURL(compressed.blob);
        previewUrls.current.push(preview);
        return { ...compressed, id: crypto.randomUUID(), preview };
      }));
      setPhotos((current) => [...current, ...additions]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to process photo."); }
    setBusy(false);
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!subject) return;
    setBusy(true); setMessage("");
    const chosenTags = [
      ...Object.entries(selectedTags).map(([id, note]) => ({ id: Number(id), note })),
      ...(otherSelected && otherLabel.trim() ? [{ label: otherLabel.trim(), note: otherNote }] : []),
    ];
    const result = await saveReview({ reviewId: initialReview?.id, subjectId: subject.id, kind: subject.kind, rating, body, visitDate, stayStart, stayEnd, selectedTags: chosenTags });
    if (result.error) { setMessage(result.error); setBusy(false); return; }
    const reviewId = result.reviewId!;
    if (photos.length) {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) { setMessage("Review saved. Sign in again to upload photos."); setBusy(false); return; }
      const uploaded: { storageKey: string; width: number; height: number; position: number }[] = [];
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        const storageKey = `${user.id}/${reviewId}/${crypto.randomUUID()}.jpg`;
        const { error } = await client.storage.from("review-photos").upload(storageKey, photo.blob, { contentType: "image/jpeg", upsert: false });
        if (error) { setMessage(`Review saved, but photo upload failed: ${error.message}`); setBusy(false); return; }
        uploaded.push({ storageKey, width: photo.width, height: photo.height, position: initialMedia.length + index });
      }
      const attachment = await attachMedia(reviewId, uploaded);
      if (attachment.error) { setMessage(`Review saved, but photo records could not be attached: ${attachment.error}`); setBusy(false); return; }
    }
    router.push(`/s/${subject.id}`); router.refresh();
  }

  const stepTitles = ["Identify", "Details", "Rating", "Photos", "Tags"];
  return <div className="mx-auto max-w-3xl">
    <div className="mb-7 flex items-end justify-between"><div><p className="eyebrow">{initialReview ? "Edit review" : "New review"}</p><h1 className="serif mt-1 text-4xl">{initialReview ? "Make it yours." : "Tell the whole story."}</h1></div><span className="text-xs text-[var(--muted)]">Step {step} of 5</span></div>
    <div className="mb-8 grid grid-cols-5 border-b border-[var(--line)]">{stepTitles.map((title, index) => <div key={title} className={`border-b-2 pb-3 text-xs ${step === index + 1 ? "border-[var(--green)] font-bold text-[var(--green)]" : "border-transparent text-[var(--muted)]"}`}>{title}</div>)}</div>
    {step === 1 && <form onSubmit={identify} className="grid gap-5 fade-in"><fieldset><legend className="mb-2 text-sm font-semibold">What are you reviewing?</legend><div className="flex flex-wrap gap-2">{kinds.map((item) => <button key={item.value} type="button" onClick={() => setKind(item.value)} aria-pressed={kind === item.value} className={`rounded-full border px-4 py-2 text-sm ${kind === item.value ? "border-[var(--green)] bg-[var(--green-light)] text-[var(--green)]" : "border-[var(--line)] bg-white"}`}>{item.label}</button>)}</div></fieldset>
      <label className="grid gap-1 text-sm font-medium">{kind === "stay" ? "Airbnb listing link" : "Name"}<input className="field" required value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "stay" ? "Paste an Airbnb link" : "Place name"} /></label>
      {kind !== "stay" && <label className="grid gap-1 text-sm font-medium">Address<input className="field" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address" /></label>}
      {kind !== "stay" && <label className="grid gap-1 text-sm font-medium">City<input className="field" value={city} onChange={(event) => setCity(event.target.value)} /></label>}
      {candidate && <div className="border-l-4 border-[var(--gold)] bg-[#f7f1df] p-4"><p className="font-semibold">Did you mean this?</p><p className="mt-1 text-sm">{candidate.display_name}{candidate.city ? ` · ${candidate.city}` : ""}</p><button type="button" className="button mt-3" onClick={() => { setSubject(candidate); setKind(candidate.kind); setCity(candidate.city ?? city); setAddress(candidate.address ?? address); setStep(2); }}>Yes, that’s it</button></div>}
      {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}<button className="button justify-self-start" disabled={busy}>{busy ? "Checking…" : "Continue"}</button></form>}
    {step === 2 && subject && <section className="grid gap-5 fade-in"><div className="border-b border-[var(--line)] pb-4"><p className="eyebrow">{subject.kind}</p><h2 className="serif mt-1 text-2xl">{subject.display_name}</h2></div>
      {subject.kind === "stay" && <><label className="grid gap-1 text-sm">Host name<input className="field" value={hostName} onChange={(event) => setHostName(event.target.value)} /></label><label className="grid gap-1 text-sm">Host username<input className="field" value={hostUsername} onChange={(event) => setHostUsername(event.target.value)} /></label><label className="grid gap-1 text-sm">City<input className="field" value={city} onChange={(event) => setCity(event.target.value)} /></label><label className="grid gap-1 text-sm">Place type<select className="field" value={placeType} onChange={(event) => setPlaceType(event.target.value as typeof placeType)}><option value="">Choose one</option><option value="whole">Entire place</option><option value="private">Private room</option><option value="shared">Shared room</option></select></label></>}
      {(subject.kind === "hotel" || subject.kind === "restaurant" || subject.kind === "bar") && <><label className="grid gap-1 text-sm">City<input className="field" value={city} onChange={(event) => setCity(event.target.value)} /></label>{subject.kind === "hotel" && <label className="grid gap-1 text-sm">Price tier<select className="field" value={priceTier ?? ""} onChange={(event) => setPriceTier(event.target.value ? Number(event.target.value) : null)}><option value="">Choose one</option>{[1, 2, 3, 4].map((tier) => <option key={tier} value={tier}>{"$".repeat(tier)}</option>)}</select></label>}</>}
      {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}<div className="flex gap-2"><button className="button button-secondary" onClick={() => setStep(1)}>Back</button><button className="button" disabled={busy} onClick={nextFromDetails}>{busy ? "Saving…" : "Continue"}</button></div></section>}
    {step === 3 && <section className="grid gap-5 fade-in"><div><p className="text-sm font-semibold">How was it?</p><div className="mt-3"><StarRating value={rating} onChange={setRating} size="large" /></div>{rating < 0 && <p className="mt-2 text-xs text-[var(--muted)]">Choose 0 through 5 stars.</p>}</div>
      {rating === 0 && <label className="grid gap-1 text-sm font-medium">What happened?<textarea className="field min-h-36" required minLength={10} value={body} onChange={(event) => setBody(event.target.value)} /><span className={`${body.trim().length < 10 ? "text-[var(--coral)]" : "text-[var(--muted)]"} text-xs`}>{body.trim().length} / 10 minimum characters</span></label>}
      {rating > 0 && <label className="grid gap-1 text-sm">Anything else to add? <textarea className="field min-h-28" value={body} onChange={(event) => setBody(event.target.value)} /></label>}
      <label className="grid max-w-xs gap-1 text-sm">Visit date<input className="field" type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} /></label>
      {subject?.kind === "stay" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Stay start<input className="field" type="date" value={stayStart} onChange={(event) => setStayStart(event.target.value)} /></label><label className="grid gap-1 text-sm">Stay end<input className="field" type="date" value={stayEnd} onChange={(event) => setStayEnd(event.target.value)} /></label></div>}
      {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}<div className="flex gap-2"><button className="button button-secondary" onClick={() => setStep(2)}>Back</button><button className="button" disabled={rating < 0 || (rating === 0 && body.trim().length < 10)} onClick={() => setStep(4)}>Continue</button></div></section>}
    {step === 4 && <section className="grid gap-5 fade-in"><div><h2 className="serif text-2xl">Add photos</h2><p className="mt-1 text-sm text-[var(--muted)]">Up to {Math.max(0, 8 - initialMedia.length)} more.</p></div><label className="button button-secondary w-fit cursor-pointer">＋ Add photos<input className="sr-only" type="file" accept="image/*" multiple disabled={busy || initialMedia.length + photos.length >= 8} onChange={(event) => { void addPhotos(event.target.files); event.target.value = ""; }} /></label>
      {initialMedia.length > 0 && <div><p className="mb-2 text-xs text-[var(--muted)]">Already attached</p><PhotoGrid photos={initialMedia} /></div>}
      {photos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.map((photo) => <div key={photo.id} className="relative aspect-[4/3]"><img src={photo.preview} alt="Selected review" className="size-full rounded-sm object-cover" /><button type="button" aria-label="Remove photo" className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/70 text-white" onClick={() => { URL.revokeObjectURL(photo.preview); setPhotos((current) => current.filter((item) => item.id !== photo.id)); }}>×</button></div>)}</div>}
      {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}<div className="flex gap-2"><button className="button button-secondary" onClick={() => setStep(3)}>Back</button><button className="button" onClick={() => setStep(5)}>Continue</button></div></section>}
    {step === 5 && <form onSubmit={publish} className="grid gap-5 fade-in"><div><h2 className="serif text-2xl">{subject?.kind === "stay" || subject?.kind === "hotel" ? "How did your stay go?" : "How did your experience go?"}</h2><p className="mt-1 text-sm text-[var(--muted)]">Choose what mattered to you.</p></div>
      <div className="flex flex-wrap gap-3">{availableTags.map((tag) => <TagChip key={tag.id} label={tag.label} selected={tag.id in selectedTags} note={selectedTags[tag.id]} onToggle={() => setSelectedTags((current) => { const next = { ...current }; if (tag.id in next) delete next[tag.id]; else next[tag.id] = ""; return next; })} onNoteChange={(value) => setSelectedTags((current) => ({ ...current, [tag.id]: value }))} />)}<div className="flex flex-col gap-1"><TagChip label="Other" selected={otherSelected} onToggle={() => setOtherSelected(!otherSelected)} />{otherSelected && <div className="grid gap-2"><input className="field min-w-48 px-3 py-2 text-xs" maxLength={60} value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} placeholder="Tag label" /><input className="field min-w-48 px-3 py-2 text-xs" maxLength={140} value={otherNote} onChange={(event) => setOtherNote(event.target.value)} placeholder="Add a detail (optional)" /></div>}</div></div>
      {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}<div className="flex flex-wrap gap-2"><button type="button" className="button button-secondary" onClick={() => setStep(4)}>Back</button><button className="button" disabled={busy || rating < 0 || (rating === 0 && body.trim().length < 10)}>{busy ? "Publishing…" : initialReview ? "Save review" : "Publish review"}</button></div>
      {message.includes("You already reviewed this") && duplicateReviewId && <Link className="text-sm font-semibold text-[var(--green)] underline" href={`/write?review=${duplicateReviewId}`}>Edit your review instead</Link>}
    </form>}
  </div>;
}