// =============================================================================
// src/lib/tutor-card.ts — tutor card ka markup, ek hi jagah
//
// TutorCard.astro (static pages) aur search/parent pages (JavaScript se render)
// dono yahi function istemal karte hain. Do jagah markup rakhne se ek din wo
// alag ho jate hain — aur phir ek jagah ka safety rule doosri jagah nahi hota.
//
// ★ Is card par phone number ya wa.me link KABHI nahi. Contact tutor profile
//   page par login ke baad khulta hai.
// =============================================================================

import { svg } from './icons';
import { url } from './site';
import { classLabel, feeRange, initials, modeLabel } from './taxonomy';
import { isFeatured, isFullyVerified, type Tutor } from './types';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const titleCase = (s: string) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Badges — jo check nahi hua us par badge nahi. */
export function badgesHtml(tutor: Pick<Tutor, 'badges'>): string {
  const b = tutor.badges;

  if (isFullyVerified(tutor)) {
    return `<div class="badges"><span class="badge b-full" title="Phone, identity aur qualification — teeno check ho chuke hain">${svg('shield-check', { strokeWidth: 2.5 })}ApnaTutor Verified</span></div>`;
  }

  const bits = [
    b?.qualChecked ? `<span class="badge b-qual">${svg('graduation-cap', { strokeWidth: 2.5 })}Qualification checked</span>` : '',
    b?.idChecked ? `<span class="badge b-id">${svg('id-card', { strokeWidth: 2.5 })}Identity checked</span>` : '',
    b?.phoneChecked ? `<span class="badge b-phone">${svg('phone', { strokeWidth: 2.5 })}Phone verified</span>` : '',
  ].filter(Boolean);

  if (bits.length === 0) {
    bits.push(`<span class="badge b-none">${svg('clock', { strokeWidth: 2.5 })}Verification jari hai</span>`);
  }

  return `<div class="badges">${bits.join('')}</div>`;
}

/** Rating — ratingCount 0 par koi star nahi, saaf batate hain. */
export function ratingHtml(avg: number, count: number): string {
  return count > 0
    ? `<p class="rating">${svg('star')}${avg.toFixed(1)} <small>(${count} verified ${count === 1 ? 'review' : 'reviews'})</small></p>`
    : `<p class="rating rating-none">${svg('clock')}Naya tutor — abhi koi review nahi</p>`;
}

export function tutorCardHtml(tutor: Tutor): string {
  const featured = isFeatured(tutor);
  const role = tutor.subjects.slice(0, 2).map(titleCase).join(' & ');
  const areaLine = titleCase([tutor.areas?.[0], tutor.city].filter(Boolean).join(', '));

  const avatar = tutor.photoUrl
    ? `<img class="avatar-img" src="${esc(tutor.photoUrl)}" alt="" width="60" height="60" loading="lazy">`
    : `<div class="avatar" aria-hidden="true">${esc(initials(tutor.name))}</div>`;

  const modes = (tutor.modes ?? [])
    .map((m) => {
      const icon = m === 'online' ? 'monitor' : m === 'tutorhome' ? 'map-pin' : 'home';
      return `<span class="chip chip-mode">${svg(icon)}${esc(modeLabel(m).split(' (')[0])}</span>`;
    })
    .join('');

  const classes = (tutor.classes ?? [])
    .slice(0, 3)
    .map((c) => `<span class="chip">${esc(classLabel(c))}</span>`)
    .join('');

  return `
    <article class="tutor${featured ? ' featured' : ''}" data-tutor-card>
      ${featured ? `<span class="feat-flag">${svg('star')}Featured</span>` : ''}

      <div class="tutor-top">
        ${avatar}
        <div class="tutor-id">
          <h3>${esc(tutor.name)}</h3>
          <p class="tutor-role">${esc(role)} Tutor</p>
          ${ratingHtml(tutor.ratingAvg ?? 0, tutor.ratingCount ?? 0)}
        </div>
      </div>

      ${badgesHtml(tutor)}

      <div class="meta">
        <div>${svg('map-pin')}<span>${esc(areaLine)}</span></div>
        <div>${svg('graduation-cap')}<span>${esc(tutor.qualification)} · <b>${esc(tutor.experienceYears)} saal ka tajurba</b></span></div>
        ${tutor.availability ? `<div>${svg('calendar')}<span>${esc(tutor.availability)}</span></div>` : ''}
      </div>

      <div class="chips">${modes}${classes}</div>

      <div class="fee">
        <div><small>Monthly fee</small><strong>${esc(feeRange(tutor.feeMin, tutor.feeMax))}</strong></div>
      </div>

      <div class="tutor-actions">
        <a class="btn btn-primary btn-sm" href="${url(`/teacher/${encodeURIComponent(tutor.slug)}`)}">Profile dekhein</a>
        <a class="btn btn-outline btn-sm" href="${url(`/teacher/${encodeURIComponent(tutor.slug)}#contact`)}">
          ${svg('message-square')}Contact dekhein
        </a>
      </div>
    </article>`;
}
