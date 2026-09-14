// =============================================================================
// src/lib/analytics.ts
//
// Sab kuch GTM dataLayer ke through jata hai — seedha gtag.js ya fbq() kahin
// call nahi hota. Wajah: naya pixel ya conversion tag chahiye ho to site
// rebuild nahi karni parti, GTM dashboard se ho jata hai.
//
// ★ Event ke naam KABHI na badlo. GA4 conversions, Google Ads conversion
//   actions, Meta Pixel mapping aur audiences sab inhi naamon par bandhe hain.
//   Naam badla to sab toot jayega — aur pata bhi der se chalega.
//   docs/03-SEO-ANALYTICS.md §2
// =============================================================================

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Har event ke params — ghalat naam type error de dega. */
export interface EventParams {
  search_tutors: { city: string; subject: string; class_level: string; results_count: number };
  view_tutor_profile: { tutor_slug: string; city: string; subject: string; is_featured: boolean };
  /** ✅ primary conversion */
  unlock_contact: { tutor_slug: string; city: string; source: 'search' | 'lead' | 'profile' };
  /** ✅ conversion */
  whatsapp_click: { tutor_slug: string; city: string };
  /** ✅ conversion */
  call_click: { tutor_slug: string; city: string };
  request_start: { entry_point: string };
  /** ✅ primary conversion */
  request_submit: { city: string; subject: string; class_level: string; budget_max: number; mode: string };
  tutor_register_start: Record<string, never>;
  /** ✅ primary conversion */
  tutor_register_complete: { city: string; subjects_count: number };
  tutor_lead_interested: { city: string; subject: string };
  filter_applied: { filter_name: string; filter_value: string };
  /** Sabse qeemti event: ye batata hai log kya dhoond rahe hain jo hamare paas NAHI hai. */
  zero_results: { city: string; subject: string; class_level: string };
  /**
   * Kisi ne link aage bheja. `method` batata hai kis zariye — gaon mein
   * taqreeban sab WhatsApp hoga, magar naapna zaroori hai, andaza nahi.
   */
  invite_share: {
    method: 'whatsapp' | 'native' | 'copy' | 'sms';
    /** Kis ko bulaya ja raha hai — parents ya doosre tutors. */
    audience: 'parents' | 'tutors';
  };
  /** Ishtihaar screen par waqai nazar aaya (sirf dikhne se nahi — dekhe jaane se). */
  promo_view: { promo_id: string; slot: string; brand: string };
  /** Ishtihaar par click hua. */
  promo_click: { promo_id: string; slot: string; brand: string };
}

export type EventName = keyof EventParams;

/**
 * Ek event GTM dataLayer par push karta hai.
 *
 *   track('unlock_contact', { tutor_slug, city, source: 'search' });
 */
export function track<K extends EventName>(event: K, params: EventParams[K]): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}
