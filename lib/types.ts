export type SubjectKind = "stay" | "restaurant" | "bar" | "hotel";
export type ReviewStatus = "published" | "hidden" | "removed";
export type MediaKind = "photo" | "video";
export type MediaStatus = "ready" | "rejected";
export type ReportReason =
  | "harassment"
  | "hate_speech"
  | "doxxing"
  | "spam"
  | "illegal_content"
  | "accuses_named_person_of_crime";
export type ReportStatus = "open" | "actioned" | "dismissed";

export interface Subject extends Record<string, unknown> {
  id: string;
  kind: SubjectKind;
  canonical_key: string;
  display_name: string;
  source_url: string | null;
  host_name: string | null;
  host_username: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  place_type: "whole" | "private" | "shared" | null;
  price_tier: 1 | 2 | 3 | 4 | null;
  website: string | null;
  hours: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface Review extends Record<string, unknown> {
  id: string;
  subject_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  visit_date: string | null;
  stay_start: string | null;
  stay_end: string | null;
  verified_stay: boolean | null;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
}

export interface Tag extends Record<string, unknown> {
  id: number;
  kind: SubjectKind;
  label: string;
  slug: string;
}

export interface ReviewTag extends Record<string, unknown> {
  review_id: string;
  tag_id: number;
  value: boolean;
  note: string | null;
}

export interface Media extends Record<string, unknown> {
  id: string;
  review_id: string;
  kind: MediaKind;
  storage_key: string;
  thumb_key: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  status: MediaStatus;
  position: number;
  created_at: string;
}

export interface Report extends Record<string, unknown> {
  id: string;
  review_id: string | null;
  media_id: string | null;
  reporter_id: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface SubjectStats extends Record<string, unknown> {
  subject_id: string;
  review_count: number;
  avg_rating: number | null;
  zeros: number;
  ones: number;
  twos: number;
  threes: number;
  fours: number;
  fives: number;
  last_visit: string | null;
}

export interface Database {
  public: {
    Tables: {
      subjects: { Row: Subject; Insert: Record<string, unknown> & Partial<Subject> & Pick<Subject, "kind" | "canonical_key" | "display_name">; Update: Record<string, unknown> & Partial<Subject>; Relationships: [] };
      reviews: { Row: Review; Insert: Record<string, unknown> & Partial<Review> & Pick<Review, "subject_id" | "user_id" | "rating">; Update: Record<string, unknown> & Partial<Review>; Relationships: [] };
      tags: { Row: Tag; Insert: Record<string, unknown> & Partial<Tag> & Pick<Tag, "kind" | "label" | "slug">; Update: Record<string, unknown> & Partial<Tag>; Relationships: [] };
      review_tags: { Row: ReviewTag; Insert: Record<string, unknown> & ReviewTag; Update: Record<string, unknown> & Partial<ReviewTag>; Relationships: [] };
      media: { Row: Media; Insert: Record<string, unknown> & Partial<Media> & Pick<Media, "review_id" | "kind" | "storage_key">; Update: Record<string, unknown> & Partial<Media>; Relationships: [] };
      reports: { Row: Report; Insert: Record<string, unknown> & Partial<Report> & Pick<Report, "reporter_id" | "reason">; Update: Record<string, unknown> & Partial<Report>; Relationships: [] };
    };
    Views: { subject_stats: { Row: SubjectStats; Relationships: [] } };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
