import type { Tag } from "@/lib/types";

export type Sentiment = "positive" | "negative" | "neutral";

const defaultSentiments: Record<string, Sentiment> = {
  "would stay again": "positive",
  "wifi was fast": "positive",
  "photos matched listing": "positive",
  "front desk helpful": "positive",
  "breakfast worth it": "positive",
  "cleanliness met expectations": "positive",
  "noise level was an issue": "negative",
  "hidden fees": "negative",
  "parking cost reasonable": "neutral",
  "neighborhood felt safe": "neutral",
  other: "neutral",
};

const bareNegativeDetails = new Set(["no", "nope", "not really", "false"]);

export function resolveSentiment(tag: Pick<Tag, "label"> & { sentiment?: string | null }, detail?: string | null): Sentiment {
  const declared = tag.sentiment;
  const sentiment: Sentiment = declared === "positive" || declared === "negative" || declared === "neutral"
    ? declared
    : defaultSentiments[tag.label.trim().toLowerCase()] ?? "neutral";
  if (sentiment === "positive" && detail && bareNegativeDetails.has(detail.trim().toLowerCase())) {
    return "negative";
  }
  return sentiment;
}

export function sentimentClasses(sentiment: Sentiment): string {
  switch (sentiment) {
    case "positive":
      return "border-[#c9ddcf] bg-[#edf5ef] text-[#315c40]";
    case "negative":
      return "border-[#e8d0c8] bg-[#fbf0ec] text-[#8e4939]";
    case "neutral":
      return "border-[#d9deda] bg-[#f2f4f2] text-[#59635c]";
  }
}
