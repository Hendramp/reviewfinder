"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { attachMedia, getTags, saveReview, saveReviewTags, updateSubjectDetails } from "@/lib/actions";
import PhotoGrid from "@/components/PhotoGrid";
import StarRating from "@/components/StarRating";
import TagChip from "@/components/TagChip";
import { createClient } from "@/lib/supabase/client";
import { listingUrl, nameSimilarity } from "@/lib/normalize";
import { searchSubjects, upsertSubject, type SubjectMatch } from "@/lib/subjects";
import PhoneInput from "react-phone-number-input";
import type { Media, Review, Subject, SubjectKind, Tag } from "@/lib/types";

type ExistingTag = { id: number; label: string; note: string | null };
type PhotoDraft = { id: string; storageKey: string; width: number; height: number; preview: string };
type ReviewDraft = {
  kind: SubjectKind;
  name: string;
  subjectId: string | null;
  newSubject: { name: string; address: string } | null;
  address: string;
  rating: number;
  body: string;
  photos: PhotoDraft[];
  selectedTags: Record<number, string>;
  phone: string;
  sourceUrl: string;
  hostName: string;
  hostUsername: string;
  visitDate: string;
  stayStart: string;
  stayEnd: string;
  stayNights: string;
  nightlyCost: string;
  monthlyCost: string;
  leaseMonths: string;
  otherSelected: boolean;
  otherLabel: string;
  otherNote: string;
  reviewId: string | undefined;
  dirty: boolean;
};
const kinds: { value: SubjectKind; label: string }[] = [{ value: "stay", label: "Stays" }, { value: "hotel", label: "Hotels" }, { value: "lease", label: "Leases" }];
const areaTagSlugs = new Set(["quiet-neighborhood", "city", "farms", "suburbs", "other-area"]);
const areaTagLabels = new Set(["quiet neighborhood", "city", "farms", "suburbs", "other area"]);
const leaseTagGroups = [
  { label: "Property management", matches: /management|landlord|manager|maintenance|repair|deposit|rent|fee|communication/i },
  { label: "The unit", matches: /./ },
  { label: "The area", matches: /neighborhood|quiet|city|farm|suburb|area|location|transit|walk|safety|noise/i },
  { label: "Verdict", matches: /recommend|avoid|worth|value|overall|return|verdict|experience/i },
];

function getLeaseTagGroup(tag: Tag) {
  const index = [0, 2, 3].find((groupIndex) => leaseTagGroups[groupIndex].matches.test(`${tag.label} ${tag.slug}`));
  return index ?? 1;
}

function isAreaTag(tag: Tag) {
  return areaTagSlugs.has(tag.slug) || areaTagLabels.has(tag.label.toLowerCase());
}

async function compressPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
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
  const [draft, setDraft] = useState<ReviewDraft>(() => ({
    kind: initialSubject?.kind ?? "stay",
    name: input || initialSubject?.display_name || "",
    subjectId: initialSubject?.id ?? null,
    newSubject: null,
    address: initialSubject?.address ?? "",
    rating: initialReview?.rating ?? -1,
    body: initialReview?.body ?? "",
    photos: [],
    selectedTags: Object.fromEntries(initialReviewTags.map((tag) => [tag.id, tag.note ?? ""])),
    phone: initialSubject?.phone ?? "",
    sourceUrl: initialSubject?.source_url ?? "",
    hostName: initialSubject?.host_name ?? "",
    hostUsername: initialSubject?.host_username ?? "",
    visitDate: initialReview?.visit_date ?? "",
    stayStart: initialReview?.stay_start ?? "",
    stayEnd: initialReview?.stay_end ?? "",
    stayNights: initialReview?.stay_nights?.toString() ?? "",
    nightlyCost: initialReview?.nightly_cost?.toString() ?? "",
    monthlyCost: initialReview?.monthly_cost?.toString() ?? "",
    leaseMonths: initialReview?.lease_months?.toString() ?? "",
    otherSelected: false,
    otherLabel: "",
    otherNote: "",
    reviewId: initialReview?.id,
    dirty: false,
  }));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [matches, setMatches] = useState<SubjectMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const previewUrls = useRef<string[]>([]);
  const [message, setMessage] = useState("");
  const [duplicateReviewId, setDuplicateReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | "back" | null>(null);
  const [published, setPublished] = useState(false);
  const historyGuard = useRef(false);
  const updateDraft = (update: (current: ReviewDraft) => ReviewDraft) => setDraft((current) => {
    const next = update(current);
    draftRef.current = next;
    return next;
  });
  const router = useRouter();

  useEffect(() => {
    if (step === 3) getTags(draft.kind).then((result) => {
      setAvailableTags(result.tags);
      updateDraft((current) => {
        const selectedAreaTag = result.tags.find((tag) => isAreaTag(tag) && tag.id in current.selectedTags)?.id;
        if (selectedAreaTag === undefined) return current;
        const selectedTags = { ...current.selectedTags };
        for (const tag of result.tags) if (isAreaTag(tag) && tag.id !== selectedAreaTag) delete selectedTags[tag.id];
        return { ...current, selectedTags };
      });
      if (result.error) setMessage(result.error);
    });
  }, [step, draft.kind]);

  useEffect(() => {
    if (step !== 1 || draft.name.trim().length < 3) {
      setMatches([]);
      setSearching(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchSubjects(draft.name, draft.kind);
        if (active) setMatches(results);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not search places.");
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [step, draft.kind, draft.name]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!draftRef.current.dirty || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || link.origin !== window.location.origin || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      setPendingNavigation(`${link.pathname}${link.search}${link.hash}`);
      setShowCancel(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draftRef.current.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onPopState = () => {
      if (!draftRef.current.dirty) return;
      setPendingNavigation("back");
      setShowCancel(true);
      window.history.pushState({ reviewDraftGuard: true }, "", window.location.href);
    };
    if (draft.dirty && !historyGuard.current) {
      window.history.pushState({ reviewDraftGuard: true }, "", window.location.href);
      historyGuard.current = true;
    } else if (!draft.dirty && historyGuard.current) {
      historyGuard.current = false;
      window.history.back();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [draft.dirty]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function chooseSubject(subject: SubjectMatch) {
    updateDraft((current) => ({ ...current, subjectId: subject.id, newSubject: null, name: subject.display_name, address: subject.address ?? "", sourceUrl: subject.source_url ?? "", dirty: true }));
    setMatches([]);
    setMessage("");
  }

  function addNewSubject() {
    updateDraft((current) => ({ ...current, subjectId: null, newSubject: { name: current.name.trim(), address: current.address.trim() }, dirty: true }));
    setMatches([]);
  }

  async function discardDraft() {
    setBusy(true);
    const storageKeys = draftRef.current.photos.map((photo) => photo.storageKey);
    if (storageKeys.length) {
      const { error } = await createClient().storage.from("review-photos").remove(storageKeys);
      if (error) {
        setMessage(`Could not remove temporary photos: ${error.message}`);
        setBusy(false);
        return;
      }
    }
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    const navigation = pendingNavigation;
    if (navigation === "back") historyGuard.current = false;
    else if (historyGuard.current) {
      window.history.replaceState({}, "", window.location.href);
      historyGuard.current = false;
    }
    updateDraft(() => ({
      kind: "stay", name: "", subjectId: null, newSubject: null, address: "", rating: -1,
      body: "", photos: [], selectedTags: {}, phone: "", sourceUrl: "", hostName: "",
      hostUsername: "", visitDate: "", stayStart: "", stayEnd: "", stayNights: "",
      nightlyCost: "", monthlyCost: "", leaseMonths: "", otherSelected: false,
      otherLabel: "", otherNote: "", reviewId: undefined, dirty: false,
    }));
    setMatches([]);
    setAvailableTags([]);
    setShowCancel(false);
    setPendingNavigation(null);
    setBusy(false);
    if (navigation === "back") window.history.go(-2);
    else if (navigation) router.push(navigation);
    else router.back();
  }

  async function identify(event: React.FormEvent) {
    event.preventDefault();
    if (draft.kind === "stay") {
      if (!listingUrl(draft.sourceUrl)) {
        setMessage("Enter a valid listing URL.");
        return;
      }
      if (!draft.subjectId) {
        updateDraft((current) => ({ ...current, newSubject: { name: current.name.trim(), address: current.address.trim() } }));
      }
      setStep(2);
      return;
    }
    if (!draft.name.trim() || !hasZip || !(draft.subjectId || draft.newSubject)) {
      if (!hasZip) setMessage("Add a ZIP code so we can place this.");
      return;
    }
    setStep(2);
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setBusy(true); setMessage("");
    const remaining = Math.max(0, 8 - initialMedia.length - draft.photos.length);
    updateDraft((current) => ({ ...current, dirty: true }));
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sign in again before uploading photos.");
      for (const file of Array.from(files).slice(0, remaining)) {
        const compressed = await compressPhoto(file);
        const preview = URL.createObjectURL(compressed.blob);
        previewUrls.current.push(preview);
        const storageKey = `${user.id}/draft/${crypto.randomUUID()}.jpg`;
        const { error } = await client.storage.from("review-photos").upload(storageKey, compressed.blob, { contentType: "image/jpeg", upsert: false });
        if (error) {
          URL.revokeObjectURL(preview);
          previewUrls.current = previewUrls.current.filter((url) => url !== preview);
          throw new Error(`Could not upload photo: ${error.message}`);
        }
        const uploaded = { id: crypto.randomUUID(), storageKey, width: compressed.width, height: compressed.height, preview };
        updateDraft((current) => ({ ...current, photos: [...current.photos, uploaded], dirty: true }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to process photo.");
    }
    setBusy(false);
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if ((!draft.subjectId && !draft.newSubject) || (draft.kind !== "stay" && !hasZip) || (draft.kind === "stay" && !listingUrl(draft.sourceUrl)) || draft.rating < 0 || (draft.kind !== "stay" && draft.rating === 0 && draft.body.trim().length < 10) || !leaseMonthsValid || !stayNightsValid || !costsValid) {
      setMessage(draft.kind !== "stay" && !hasZip ? "Add a ZIP code so we can place this." : "Complete the required review details before publishing.");
      return;
    }
    setBusy(true); setMessage("");
    const chosenTags = [
      ...Object.entries(draft.selectedTags).map(([id, note]) => ({ id: Number(id), note })),
      ...(draft.otherSelected && draft.otherLabel.trim() ? [{ label: draft.otherLabel.trim(), note: draft.otherNote }] : []),
    ];
    try {
      let subjectId = draft.subjectId;
      if (!subjectId) {
        const subject = await upsertSubject({ kind: draft.kind, name: draft.name, address: draft.address, sourceUrl: draft.sourceUrl, phone: draft.phone });
        if (subject.error || !subject.subjectId) throw new Error(subject.error ?? "Could not save the place.");
        subjectId = subject.subjectId;
        updateDraft((current) => ({ ...current, subjectId, newSubject: null }));
      }
      if (draft.subjectId) {
        const details = await updateSubjectDetails({ subjectId, kind: draft.kind, hostName: draft.hostName, hostUsername: draft.hostUsername, phone: draft.phone, sourceUrl: draft.sourceUrl });
        if (details.error) throw new Error(`Could not save place details: ${details.error}`);
      }

      const result = await saveReview({
        reviewId: draft.reviewId,
        subjectId,
        kind: draft.kind,
        rating: draft.rating,
        body: draft.body,
        visitDate: draft.visitDate,
        stayStart: draft.stayStart,
        stayEnd: draft.stayEnd,
        stayNights: draft.stayNights.trim() ? Number(draft.stayNights) : null,
        nightlyCost: draft.nightlyCost.trim() ? Number(draft.nightlyCost) : null,
        monthlyCost: draft.monthlyCost.trim() ? Number(draft.monthlyCost) : null,
        leaseMonths: draft.leaseMonths.trim() ? Number(draft.leaseMonths) : null,
      });
      if (result.error || !result.reviewId) {
        if (result.duplicateReviewId) setDuplicateReviewId(result.duplicateReviewId);
        throw new Error(`Could not save review: ${result.error ?? "No review id was returned."}`);
      }
      const reviewId = result.reviewId;
      updateDraft((current) => ({ ...current, reviewId }));

      const tagResult = await saveReviewTags({ reviewId, kind: draft.kind, selectedTags: chosenTags });
      if (tagResult.error) throw new Error(tagResult.error);

      const client = createClient();
      const media: { storageKey: string; width: number; height: number; position: number }[] = [];
      for (let index = 0; index < draft.photos.length; index += 1) {
        const photo = draft.photos[index];
        let storageKey = photo.storageKey;
        if (!storageKey.startsWith(`${(await client.auth.getUser()).data.user?.id}/${reviewId}/`)) {
          const { data: { user }, error: authError } = await client.auth.getUser();
          if (authError || !user) throw new Error("Could not save photos: sign in again to continue.");
          const newKey = `${user.id}/${reviewId}/${crypto.randomUUID()}.jpg`;
          const { error } = await client.storage.from("review-photos").move(storageKey, newKey);
          if (error) throw new Error(`Could not prepare photos for the review: ${error.message}`);
          storageKey = newKey;
          updateDraft((current) => ({ ...current, photos: current.photos.map((item) => item.id === photo.id ? { ...item, storageKey } : item) }));
        }
        media.push({ storageKey, width: photo.width, height: photo.height, position: initialMedia.length + index });
      }
      if (media.length) {
        const attachment = await attachMedia(reviewId, media);
        if (attachment.error) throw new Error(`Could not save photo records: ${attachment.error}`);
      }
      updateDraft((current) => ({ ...current, dirty: false }));
      setPublished(true);
      window.setTimeout(() => {
        router.push(`/s/${subjectId}`);
        router.refresh();
      }, 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish the review. Please try again.");
    }
    setBusy(false);
  }

  const stepTitles = ["Identify", "Rating", "Photos & Details"];
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(draft.address);
  const leaseMonthsValid = draft.kind !== "lease" || !draft.leaseMonths.trim() || (Number.isInteger(Number(draft.leaseMonths)) && Number(draft.leaseMonths) >= 1 && Number(draft.leaseMonths) <= 120);
  const stayNightsValid = draft.kind !== "hotel" || !draft.stayNights.trim() || (Number.isInteger(Number(draft.stayNights)) && Number(draft.stayNights) >= 1);
  const activeCosts = draft.kind === "hotel" ? [draft.nightlyCost] : draft.kind === "lease" ? [draft.monthlyCost] : [];
  const costsValid = activeCosts.every((cost) => !cost.trim() || (Number.isFinite(Number(cost)) && Number(cost) >= 0));
  const fuzzyMatches = matches.map((subject) => ({ subject, similarity: nameSimilarity(draft.name, subject.display_name) }))
    .filter((match) => match.similarity > 0.4)
    .sort((a, b) => b.similarity - a.similarity);
  const fuzzyIds = new Set(fuzzyMatches.map(({ subject }) => subject.id));
  const ilikeMatches = matches.filter((subject) => subject.display_name.toLowerCase().includes(draft.name.trim().toLowerCase()) && !fuzzyIds.has(subject.id));

  async function removePhoto(photo: PhotoDraft) {
    const { error } = await createClient().storage.from("review-photos").remove([photo.storageKey]);
    if (error) { setMessage(`Could not remove photo: ${error.message}`); return; }
    URL.revokeObjectURL(photo.preview);
    previewUrls.current = previewUrls.current.filter((url) => url !== photo.preview);
    updateDraft((current) => ({ ...current, photos: current.photos.filter((item) => item.id !== photo.id), dirty: true }));
  }

  return <div className="mx-auto max-w-3xl">
    {published ? <div role="status" className="review-published rounded border border-[var(--border)] bg-[var(--surface)] p-8 text-center"><p className="eyebrow">Review published</p><p className="serif mt-2 text-2xl">Thank you for sharing your experience.</p></div> : <>
      <div className="mb-7 flex items-end justify-between"><div><p className="eyebrow">{initialReview ? "Edit review" : "New review"}</p><h1 className="serif mt-1 text-4xl">{initialReview ? "Make it yours." : "Tell the whole story."}</h1></div><span className="text-xs text-[var(--muted)]">Step {step} of 3</span></div>
      <div className="mb-8 grid grid-cols-3 border-b border-[var(--line)]">{stepTitles.map((title, index) => <div key={title} className={`border-b-2 pb-3 text-xs ${step === index + 1 ? "border-[var(--green)] font-bold text-[var(--green)]" : "border-transparent text-[var(--muted)]"}`}>{title}</div>)}</div>
      {step === 1 && <form onSubmit={identify} className="grid gap-5 fade-in">
        <fieldset><legend className="mb-2 text-sm font-semibold">What are you reviewing?</legend><div className="flex flex-wrap gap-2">{kinds.map((item) => <button key={item.value} type="button" onClick={() => { setMatches([]); updateDraft((current) => ({ ...current, kind: item.value, subjectId: null, newSubject: null, dirty: true })); }} aria-pressed={draft.kind === item.value} className={`min-h-11 rounded-full border px-4 py-2 text-sm ${draft.kind === item.value ? "border-[var(--green)] bg-[var(--green-light)] text-[var(--green)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>{item.label}</button>)}</div></fieldset>
        {draft.kind === "stay" ? <>
          <label className="grid gap-1 text-sm font-medium">Listing URL<input className="field" type="url" required value={draft.sourceUrl} onChange={(event) => updateDraft((current) => ({ ...current, sourceUrl: event.target.value, subjectId: null, newSubject: null, dirty: true }))} placeholder="https://…" /></label>
          <details className="border-y border-[var(--border)] py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Optional place details</summary><div className="grid gap-4 py-3">
            <label className="grid gap-1 text-sm">Place name<input className="field" value={draft.name} onChange={(event) => { setMatches([]); updateDraft((current) => ({ ...current, name: event.target.value, subjectId: null, newSubject: null, dirty: true })); }} placeholder="Optional" /></label>
            <label className="grid gap-1 text-sm">Address<input className="field" value={draft.address} onChange={(event) => updateDraft((current) => ({ ...current, address: event.target.value, subjectId: null, newSubject: null, dirty: true }))} placeholder="Optional" /></label>
          </div></details>
        </> : <>
          <label className="grid gap-1 text-sm font-medium">Name<input className="field" required value={draft.name} onChange={(event) => { setMatches([]); updateDraft((current) => ({ ...current, name: event.target.value, subjectId: null, newSubject: current.newSubject ? { ...current.newSubject, name: event.target.value } : null, dirty: true })); }} placeholder="Listing or place name" /></label>
          <label className="grid gap-1 text-sm font-medium">Street address<input className="field" required value={draft.address} onChange={(event) => updateDraft((current) => ({ ...current, address: event.target.value, subjectId: null, newSubject: current.newSubject ? { ...current.newSubject, address: event.target.value } : null, dirty: true }))} placeholder="Street address, city, state, ZIP" /></label>
        </>}
        {searching && <p className="-mt-3 text-xs text-[var(--muted)]">Searching places&hellip;</p>}
        {(fuzzyMatches.length > 0 || ilikeMatches.length > 0) && <div className="-mt-3 grid gap-3 rounded border border-[var(--border)] bg-[var(--surface)] p-4">
          {fuzzyMatches.length > 0 && <section><p className="text-sm font-semibold">Did you mean&#8230;</p><ul className="mt-2 grid gap-2">{fuzzyMatches.map(({ subject }) => <li key={subject.id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{subject.display_name}{subject.address ? <> &middot; {subject.address}</> : ""}</span><button type="button" className="button button-secondary" onClick={() => chooseSubject(subject)}>Use this place</button></li>)}</ul></section>}
          {ilikeMatches.length > 0 && <section><p className="text-sm font-semibold">Matching places</p><ul className="mt-2 grid gap-2">{ilikeMatches.map((subject) => <li key={subject.id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{subject.display_name}{subject.address ? <> &middot; {subject.address}</> : ""}</span><button type="button" className="button button-secondary" onClick={() => chooseSubject(subject)}>Use this place</button></li>)}</ul></section>}
        </div>}
        {draft.name.trim() && !draft.subjectId && <button type="button" className="-mt-3 min-h-11 justify-self-start text-sm font-semibold underline" onClick={addNewSubject}>None of these &mdash; add it</button>}
        {draft.subjectId && <p className="text-sm text-[var(--muted)]">Selected existing place. Your review will create its public page if it has no reviews yet.</p>}
        {draft.kind !== "stay" && !hasZip && <p className="-mt-3 text-xs text-[var(--muted)]">Add a ZIP code so we can place this.</p>}
        {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}
        <button className="button justify-self-start" disabled={busy || (draft.kind === "stay" ? !listingUrl(draft.sourceUrl) : !hasZip || !draft.name.trim() || !(draft.subjectId || draft.newSubject))}>{busy ? "Please wait…" : "Continue"}</button>
      </form>}
      {step === 2 && <section className="grid gap-5 fade-in"><div className="border-b border-[var(--line)] pb-4"><p className="eyebrow">{draft.kind}</p><h2 className="serif mt-1 text-2xl">{draft.name || (draft.kind === "stay" ? "Your stay" : "")}</h2>{draft.address && <p className="mt-1 text-sm text-[var(--muted)]">{draft.address}</p>}</div>
        <div><p className="text-sm font-semibold">How was it?</p><div className="mt-3"><StarRating value={draft.rating} onChange={(value) => updateDraft((current) => ({ ...current, rating: value, dirty: true }))} size="large" /></div>{draft.rating < 0 && <p className="mt-2 text-xs text-[var(--muted)]">Choose 0 through 5 stars.</p>}{draft.rating === 0 && <p className="mt-2 text-sm text-[var(--earth)]">Sorry it wasn&rsquo;t a good experience. Your perspective can help someone else.</p>}</div>
        <label className="grid gap-1 text-sm font-medium">Written review{draft.rating === 0 && draft.kind !== "stay" && <span className="text-xs font-normal text-[var(--muted)]">Share a little about what made it difficult</span>}<textarea className="field min-h-36" required={draft.rating === 0 && draft.kind !== "stay"} minLength={draft.rating === 0 && draft.kind !== "stay" ? 10 : undefined} value={draft.body} onChange={(event) => updateDraft((current) => ({ ...current, body: event.target.value, dirty: true }))} placeholder={draft.rating === 0 ? "What would you want someone else to know?" : undefined} /><span className={`${draft.rating === 0 && draft.kind !== "stay" && draft.body.trim().length < 10 ? "text-[var(--danger)]" : "text-[var(--muted)]"} text-xs`}>{draft.rating === 0 && draft.kind !== "stay" ? `${draft.body.trim().length} / 10 minimum characters` : "Optional"}</span></label>
        {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}
        <div className="flex gap-2"><button className="button button-secondary" onClick={() => setStep(1)}>Back</button><button className="button" disabled={draft.rating < 0 || (draft.kind !== "stay" && draft.rating === 0 && draft.body.trim().length < 10)} onClick={() => setStep(3)}>Continue</button></div>
      </section>}
      {step === 3 && <form onSubmit={publish} className="grid gap-7 fade-in">
        <section className="grid gap-3"><div><h2 className="serif text-2xl">Add photos</h2><p className="mt-1 text-sm text-[var(--muted)]">Up to {Math.max(0, 8 - initialMedia.length)} photos.</p></div><label className="button button-secondary w-fit cursor-pointer">? Add photos<input className="sr-only" type="file" accept="image/*" multiple disabled={busy || initialMedia.length + draft.photos.length >= 8} onChange={(event) => { void addPhotos(event.target.files); event.target.value = ""; }} /></label>
          {initialMedia.length > 0 && <div><p className="mb-2 text-xs text-[var(--muted)]">Already attached</p><PhotoGrid photos={initialMedia} /></div>}
          {draft.photos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{draft.photos.map((photo) => <div key={photo.id} className="relative aspect-[4/3]"><img src={photo.preview} alt="Selected review" className="size-full rounded-sm object-cover" /><button type="button" aria-label="Remove photo" className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/70 text-white" onClick={() => void removePhoto(photo)}>?</button></div>)}</div>}
        </section>
        <section className="grid gap-3"><div><h2 className="serif text-2xl">What mattered to you?</h2><p className="mt-1 text-sm text-[var(--muted)]">Choose any that apply.</p></div>
          {draft.kind === "lease" ? leaseTagGroups.map((group, groupIndex) => {
            const groupTags = availableTags.filter((tag) => getLeaseTagGroup(tag) === groupIndex);
            return <details key={group.label} className="border-b border-[var(--border)] py-2"><summary className="min-h-11 cursor-pointer content-center font-semibold">{group.label} <span className="text-sm font-normal text-[var(--muted)]">({groupTags.length})</span></summary><fieldset className="grid gap-2 py-2"><legend className="sr-only">{group.label}</legend><div className="flex flex-wrap gap-3">{groupTags.map((tag) => isAreaTag(tag) ? <label key={tag.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${tag.id in draft.selectedTags ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}><input type="radio" name="lease-area" checked={tag.id in draft.selectedTags} onChange={() => updateDraft((current) => { const selectedTags = { ...current.selectedTags }; for (const id of availableTags.filter(isAreaTag).map((item) => item.id)) delete selectedTags[id]; selectedTags[tag.id] = ""; return { ...current, selectedTags, dirty: true }; })} />{tag.label}</label> : <TagChip key={tag.id} label={tag.label} selected={tag.id in draft.selectedTags} note={draft.selectedTags[tag.id]} onToggle={() => updateDraft((current) => { const selectedTags = { ...current.selectedTags }; if (tag.id in selectedTags) delete selectedTags[tag.id]; else selectedTags[tag.id] = ""; return { ...current, selectedTags, dirty: true }; })} onNoteChange={(value) => updateDraft((current) => ({ ...current, selectedTags: { ...current.selectedTags, [tag.id]: value }, dirty: true }))} />)}</div></fieldset></details>;
          }) : <div className="flex flex-wrap gap-3">{availableTags.map((tag) => <TagChip key={tag.id} label={tag.label} selected={tag.id in draft.selectedTags} note={draft.selectedTags[tag.id]} onToggle={() => updateDraft((current) => { const selectedTags = { ...current.selectedTags }; if (tag.id in selectedTags) delete selectedTags[tag.id]; else selectedTags[tag.id] = ""; return { ...current, selectedTags, dirty: true }; })} onNoteChange={(value) => updateDraft((current) => ({ ...current, selectedTags: { ...current.selectedTags, [tag.id]: value }, dirty: true }))} />)}</div>}
          <div className="flex flex-col gap-1"><TagChip label="Other" selected={draft.otherSelected} onToggle={() => updateDraft((current) => ({ ...current, otherSelected: !current.otherSelected, dirty: true }))} />{draft.otherSelected && <div className="grid gap-2"><input className="field px-3 py-2 text-xs" maxLength={60} value={draft.otherLabel} onChange={(event) => updateDraft((current) => ({ ...current, otherLabel: event.target.value, dirty: true }))} placeholder="Tag label" /><input className="field px-3 py-2 text-xs" maxLength={140} value={draft.otherNote} onChange={(event) => updateDraft((current) => ({ ...current, otherNote: event.target.value, dirty: true }))} placeholder="Add a detail (optional)" /></div>}</div>
        </section>
        <details className="border-y border-[var(--border)] py-3"><summary className="min-h-11 cursor-pointer content-center font-semibold">More details <span className="text-sm font-normal text-[var(--muted)]">Optional</span></summary><div className="grid gap-4 py-3">
          <label className="grid gap-1 text-sm">Phone number<PhoneInput className="PhoneInput" inputClassName="field" value={draft.phone || undefined} onChange={(value) => updateDraft((current) => ({ ...current, phone: value ?? "", dirty: true }))} placeholder="Optional &mdash; add a phone number" /></label>
          {draft.kind === "stay" && <><label className="grid gap-1 text-sm">Host name<input className="field" value={draft.hostName} onChange={(event) => updateDraft((current) => ({ ...current, hostName: event.target.value, dirty: true }))} /></label><label className="grid gap-1 text-sm">Host username<input className="field" value={draft.hostUsername} onChange={(event) => updateDraft((current) => ({ ...current, hostUsername: event.target.value, dirty: true }))} /></label>
            <label className="grid max-w-xs gap-1 text-sm">Visit date<input className="field" type="date" value={draft.visitDate} onChange={(event) => updateDraft((current) => ({ ...current, visitDate: event.target.value, dirty: true }))} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Stay start<input className="field" type="date" value={draft.stayStart} onChange={(event) => updateDraft((current) => ({ ...current, stayStart: event.target.value, dirty: true }))} /></label><label className="grid gap-1 text-sm">Stay end<input className="field" type="date" value={draft.stayEnd} onChange={(event) => updateDraft((current) => ({ ...current, stayEnd: event.target.value, dirty: true }))} /></label></div></>}
          {draft.kind === "hotel" && <><label className="grid gap-1 text-sm">How much was it per night?<input className="field" type="number" min={0} step="0.01" inputMode="decimal" value={draft.nightlyCost} onChange={(event) => updateDraft((current) => ({ ...current, nightlyCost: event.target.value, dirty: true }))} placeholder="Optional amount in USD" /></label><label className="grid max-w-xs gap-1 text-sm">How many nights?<input className="field" type="number" min={1} step={1} inputMode="numeric" value={draft.stayNights} onChange={(event) => updateDraft((current) => ({ ...current, stayNights: event.target.value, dirty: true }))} placeholder="Optional" /></label></>}
          {draft.kind === "lease" && <><label className="grid max-w-xs gap-1 text-sm">How much did you spend per month?<input className="field" type="number" min={0} step="0.01" inputMode="decimal" value={draft.monthlyCost} onChange={(event) => updateDraft((current) => ({ ...current, monthlyCost: event.target.value, dirty: true }))} placeholder="Optional amount in USD" /></label><label className="grid max-w-xs gap-1 text-sm">How long was the lease?<span className="flex items-center gap-2"><input className="field" type="number" min={1} max={120} step={1} value={draft.leaseMonths} onChange={(event) => updateDraft((current) => ({ ...current, leaseMonths: event.target.value, dirty: true }))} /><span>months</span></span><span className="text-xs text-[var(--muted)]">Enter a whole number from 1 to 120.</span></label></>}
        </div></details>
        {message && <p role="alert" className="text-sm text-[var(--coral)]">{message}</p>}
        {message.includes("You already reviewed this") && duplicateReviewId && <Link className="text-sm font-semibold text-[var(--green)] underline" href={`/write?review=${duplicateReviewId}`}>Edit your review instead</Link>}
        <div className="flex flex-wrap gap-2"><button type="button" className="button button-secondary" onClick={() => setStep(2)}>Back</button><button className="button" disabled={busy || draft.rating < 0 || (draft.kind !== "stay" && draft.rating === 0 && draft.body.trim().length < 10) || !leaseMonthsValid || !stayNightsValid || !costsValid}>{busy ? "Publishing&hellip;" : initialReview ? "Save review" : "Publish review"}</button></div>
      </form>}
      {showCancel && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" className="cancel-dialog w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"><h2 id="discard-title" className="serif text-2xl">Discard this review?</h2><p className="mt-2 text-sm text-[var(--muted)]">Your changes and uploaded photos will be removed.</p>{message && <p role="alert" className="mt-3 text-sm text-[var(--coral)]">{message}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" autoFocus className="button" onClick={() => { setShowCancel(false); setPendingNavigation(null); setMessage(""); }}>Keep editing</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => void discardDraft()}>Discard</button></div></div></div>}
    </>}
  </div>;
}
