"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VehicleCard } from "@/components/VehicleCard";
import type { FxView, VehicleCardView } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Static teaser data (marketing). Real inventory loads in Stage 2.   */
/* ------------------------------------------------------------------ */

const FORD = { p: 17900, s: 1750, c: 2600000 }; // hero ledger = 2017 Ford Edge
const H = 0.12;

const FAQS: [string, string][] = [
  ["How is the landed cost worked out?", "It's the purchase price plus ocean shipping, plus the Lagos clearing quote, plus our 12% handling fee. Every line is shown in dollars and naira, and the total updates live as the exchange rate moves."],
  ["RoRo or container - what's the difference?", "RoRo (roll-on/roll-off) is usually cheaper and a little faster for a single car. A container can be shared with other vehicles or booked solely, and offers more protection. You can toggle between them on each listing and watch the total recompute."],
  ["How does clearing in Lagos work?", "Clearing is a manually entered figure on each vehicle, taken from an accredited Lagos agent's written quotation - a real number for that specific car, not an automated estimate or an age-based rule."],
  ["Do I need to subscribe to buy?", "Browsing is open to everyone. Buy Now and Make an Offer require a Premium membership, which also locks your quoted rate for 72 hours."],
  ["What happens when the exchange rate moves?", "Listed prices reprice in real time. When you're Premium and request a quote, make an offer, or reserve, the rate freezes for 72 hours so it can't move against you mid-deal."],
  ["How do I pay for the car?", "You reserve the vehicle in-app at the locked total. Our team then finalises payment with you through secure transfer - initially off-platform, with escrow planned - never to a personal account."],
];

/* ------------------------------------------------------------------ */
/* Bits                                                               */
/* ------------------------------------------------------------------ */

const Logo = () => (
  <div className="logo">
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5v5a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" fill="#0B1413" />
      <circle cx="7.5" cy="14.5" r="1.4" fill="#E8973A" />
      <circle cx="16.5" cy="14.5" r="1.4" fill="#E8973A" />
    </svg>
  </div>
);

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const fmtCAD = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const fmtNGNraw = (n: number) => Math.round(n).toLocaleString("en-NG");

function FaqList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {FAQS.map(([q, a], i) => (
        <div className={`qa ${open === i ? "open" : ""}`} key={i}>
          <button onClick={() => setOpen(open === i ? null : i)}>
            {q}
            <span className="plus">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          </button>
          <div className="ans"><p>{a}</p></div>
        </div>
      ))}
    </div>
  );
}

/* Isolated so the menu toggle re-renders only the nav, never the live ticker/odometer. */
function LandingNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="lnav-in">
      <div className="brand">
        <Logo />
        <div className="wm">Ayende Autos<small>CANADA → LAGOS</small></div>
      </div>
      <div className="lnav-r">
        <Link className="ghost" href="/gallery">Browse</Link>
        <Link className="solid" href="/gallery">Get started</Link>
      </div>
      <button
        className={`lnav-burger ${open ? "open" : ""}`}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="lnav-menu">
          <Link href="/gallery" onClick={close}>Browse</Link>
          <Link className="solid" href="/gallery" onClick={close}>Get started</Link>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing                                                            */
/* ------------------------------------------------------------------ */

export function Landing({ recent, fx, favoritedIds = [] }: { recent: VehicleCardView[]; fx: FxView; favoritedIds?: string[] }) {
  // Hero ledger animates imperatively (matches the mockup) so it never
  // re-renders with React state. FAQ owns its own state in <FaqList/>.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let hr = 1150;
    let heroLast = Date.now();
    const prev: Record<string, number> = {};

    const tween = (id: string, to: number, fmt: (n: number) => string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const from = prev[id] ?? to;
      prev[id] = to;
      if (reduced || from === to) { el.textContent = fmt(to); return; }
      const t0 = performance.now(), dur = 600;
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const setOdometer = (el: HTMLElement, str: string) => {
      const mask = str.replace(/\d/g, "#");
      if (el.dataset.mask !== mask) {
        const nara = el.querySelector(".nara");
        el.innerHTML = "";
        if (nara) el.appendChild(nara);
        for (const ch of str) {
          if (ch >= "0" && ch <= "9") {
            const reel = document.createElement("span");
            reel.className = "reel";
            const strip = document.createElement("span");
            strip.className = "strip";
            for (let d = 0; d < 10; d++) {
              const dn = document.createElement("span");
              dn.className = "dnum";
              dn.textContent = String(d);
              strip.appendChild(dn);
            }
            reel.appendChild(strip);
            el.appendChild(reel);
          } else {
            const s = document.createElement("span");
            s.className = "sep";
            s.textContent = ch;
            el.appendChild(s);
          }
        }
        el.dataset.mask = mask;
      }
      const reels = el.querySelectorAll<HTMLElement>(".reel");
      const digits = str.replace(/\D/g, "");
      const n = digits.length;
      reels.forEach((reel, i) => {
        const d = +digits[i]!;
        const strip = reel.firstChild as HTMLElement;
        if (reduced) {
          strip.style.transition = "none";
        } else {
          strip.style.transition = "transform .8s cubic-bezier(.2,.85,.2,1)";
          strip.style.transitionDelay = (n - i - 1) * 0.04 + "s";
        }
        strip.style.transform = `translateY(calc(${-d} * var(--dh)))`;
      });
    };

    const heroRecompute = () => {
      const sub = (FORD.p + FORD.s) * hr + FORD.c;
      const fee = sub * H;
      const total = sub * (1 + H);
      const totalCAD = total / hr;
      tween("h_purCad", FORD.p, fmtCAD);
      tween("h_purNgn", FORD.p * hr, (x) => "₦" + fmtNGNraw(x));
      tween("h_shpCad", FORD.s, fmtCAD);
      tween("h_shpNgn", FORD.s * hr, (x) => "₦" + fmtNGNraw(x));
      const clr = document.getElementById("h_clrNgn");
      if (clr) clr.textContent = "₦" + fmtNGNraw(FORD.c);
      tween("h_clrCad", FORD.c / hr, fmtCAD);
      tween("h_hndNgn", fee, (x) => "₦" + fmtNGNraw(x));
      tween("h_hndCad", fee / hr, fmtCAD);
      const odo = document.getElementById("h_odo");
      if (odo) setOdometer(odo, fmtNGNraw(total));
      tween("h_totCad", totalCAD, fmtCAD);
      const t = document.getElementById("t_rate");
      if (t) t.textContent = "1 CAD = ₦" + hr.toLocaleString("en-NG");
      heroLast = Date.now();
      const ago = document.getElementById("t_ago");
      if (ago) ago.textContent = "updated now";
    };

    heroRecompute();
    const walk = setInterval(() => {
      const d = Math.round((Math.random() - 0.45) * 9);
      hr = Math.max(1080, Math.min(1240, hr + d));
      heroRecompute();
    }, 1800);
    const ticker = setInterval(() => {
      const s = Math.round((Date.now() - heroLast) / 1000);
      const ago = document.getElementById("t_ago");
      if (ago) ago.textContent = s <= 0 ? "updated now" : `updated ${s}s ago`;
    }, 1000);

    return () => { clearInterval(walk); clearInterval(ticker); };
  }, []);

  return (
    <div id="landing">
      <nav className="lnav">
        <LandingNav />
        <div className="ticker">
          <span className="dot" />
          <span>LIVE FX</span><span className="sep">·</span>
          <span className="rate" id="t_rate">1 CAD = ₦1,150</span><span className="sep">·</span>
          <span id="t_ago">updated now</span>
        </div>
      </nav>

      <div className="lwrap">
        <section className="hero">
          <div className="hero-l">
            <div className="eyebrow">Every cost · shown · before you commit</div>
            <h1>Canadian cars,<br /><em>landed in Lagos.</em></h1>
            <p className="lede">Browse used vehicles sourced and inspected in Canada, each with the full landed cost - purchase, shipping, Lagos clearing and our 12% handling - itemised in dollars and naira, and repriced live as the rate moves. No surprises at the port.</p>
            <div className="hero-cta">
              <Link className="btn-xl amber" href="/gallery"><Arrow />Get started</Link>
              <Link className="btn-xl line" href="/gallery">Browse vehicles</Link>
            </div>
            <div className="hero-trust"><span className="tdot" />Live FX feed<span className="tdot" />RoRo &amp; container<span className="tdot" />Premium to buy</div>
          </div>

          <div className="hero-r">
            <div className="hcard">
              <div className="hcard-band">
                <span className="t">LANDED COST · LIVE</span>
                <span className="live-pill"><span className="dot" />Repricing</span>
              </div>
              <div className="hcard-body">
                <div className="ledger">
                  <div className="seclabel origin">Origin · Canada<span className="ln" /></div>
                  <div className="lline origin">
                    <div className="name">Purchase price<div className="meta">2017 Ford Edge Titanium</div></div>
                    <div className="lvals"><div className="primary" id="h_purCad">$17,900</div><div className="secondary" id="h_purNgn">₦20,585,000</div></div>
                  </div>
                  <div className="lline origin">
                    <div className="name">Ocean shipping<div className="meta">RoRo · Halifax → Lagos</div></div>
                    <div className="lvals"><div className="primary" id="h_shpCad">$1,750</div><div className="secondary" id="h_shpNgn">₦2,012,500</div></div>
                  </div>
                  <div className="crossing"><span className="track" /><span className="lbl">🚢 Crosses to Lagos</span><span className="track" /></div>
                  <div className="seclabel dest">Destination · Lagos<span className="ln" /></div>
                  <div className="lline dest">
                    <div className="name">Clearing &amp; duty<div className="meta">Manual agent quotation</div></div>
                    <div className="lvals"><div className="primary" id="h_clrNgn">₦2,600,000</div><div className="secondary" id="h_clrCad">$2,261</div></div>
                  </div>
                  <div className="lline dest">
                    <div className="name">Ayende Autos handling<div className="meta">12% of landed subtotal</div></div>
                    <div className="lvals"><div className="primary" id="h_hndNgn">₦3,023,700</div><div className="secondary" id="h_hndCad">$2,629</div></div>
                  </div>
                  <div className="totalblk">
                    <div className="stamp"><div className="big">CLEARED</div><div className="small">PORT OF LAGOS · 2026</div></div>
                    <div className="tk">Total landed cost<span className="ln" /></div>
                    <div className="odo" id="h_odo"><span className="nara">₦</span></div>
                    <div className="cad-line"><span className="pill">≈ CAD</span><span className="cadval" id="h_totCad">$24,540</span><span className="note">delivered &amp; cleared</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="sec-eyebrow">How it works</div>
          <div className="sec-title">Three steps from a Canadian lot to your gate.</div>
          <div className="steps">
            <div className="step">
              <div className="num">01 · SOURCE</div>
              <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg></div>
              <h3>We source in Canada</h3>
              <p>We find and inspect used vehicles across Canada - graded for condition, VIN-verified, with accident history checked before they're listed.</p>
            </div>
            <div className="step">
              <div className="num">02 · PRICE</div>
              <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></div>
              <h3>You see the full cost</h3>
              <p>Every listing itemises the landed total - purchase, shipping, Lagos clearing and 12% handling - in dollars and naira, repriced live as the rate moves.</p>
            </div>
            <div className="step">
              <div className="num">03 · LAND</div>
              <div className="icn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5v5h-3v-2H6v2H3z" /></svg></div>
              <h3>Reserve &amp; we land it</h3>
              <p>Premium members reserve at a rate locked for 72 hours. We ship by RoRo or container and clear it in Lagos through an accredited agent.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="sec-eyebrow">Why trust us</div>
          <div className="sec-title">The whole price, on the table.</div>
          <p className="sec-sub">Buying a car across an ocean means trusting a number. So we show you every figure that makes it up - nothing rounded away, nothing waiting for you at the dock.</p>
          <div className="trust">
            <div className="tcard">
              <div className="k"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>Nothing hidden</div>
              <h4>Every line itemised</h4>
              <p>Purchase, shipping, clearing and the 12% handling fee are shown as separate lines - the markup is on the table, not buried in the price.</p>
            </div>
            <div className="tcard">
              <div className="k"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>Two currencies</div>
              <h4>Dollars and naira, always</h4>
              <p>Every figure appears in CAD and ₦ side by side, so the price reads the same whether you think in dollars or naira.</p>
            </div>
            <div className="tcard">
              <div className="k"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Live, then locked</div>
              <h4>Real-time FX with a 72-hour lock</h4>
              <p>Listed prices move with the live exchange rate. When you're ready as a Premium member, your quote freezes for 72 hours.</p>
            </div>
            <div className="tcard">
              <div className="k"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h20M5 20V9l7-4 7 4v11" /></svg>Real quotes</div>
              <h4>Clearing from accredited agents</h4>
              <p>The Lagos clearing figure on each car comes from an accredited agent's written quotation - a real number, not an estimate.</p>
            </div>
          </div>
        </section>

        {recent.length > 0 && (
        <section className="section">
          <div className="feat-head">
            <div>
              <div className="sec-eyebrow">Landed &amp; available</div>
              <div className="sec-title">Recently arrived.</div>
            </div>
            <Link className="viewall" href="/gallery">View all inventory<Arrow /></Link>
          </div>
          <div className="feat-grid">
            {recent.map((c) => (
              <VehicleCard key={c.id} v={c} fx={fx} favorited={favoritedIds.includes(c.id)} />
            ))}
          </div>
        </section>
        )}

        <section className="section">
          <div className="sec-eyebrow">Questions</div>
          <div className="sec-title">Good to know.</div>
          <FaqList />
        </section>

        <div className="ctaband">
          <h2>Ready to see what's landed?</h2>
          <p>Create a free account to browse the full inventory. Go Premium when you're ready to buy or make an offer.</p>
          <div className="hero-cta">
            <Link className="btn-xl amber" href="/gallery"><Arrow />Get started</Link>
            <Link className="btn-xl line" href="/gallery">Browse vehicles</Link>
          </div>
        </div>

        <footer className="lfoot">
          <div className="frow">
            <div className="brand">
              <Logo />
              <div className="wm">Ayende Autos<small>CANADA → LAGOS</small></div>
            </div>
            <Link className="ghost" href="/gallery">Browse inventory</Link>
          </div>
          <div className="copy">© 2026 Ayende Autos<br />Canadian cars, landed in Lagos. FX rates indicative until rate-locked. Clearing figures from accredited agent quotations.</div>
        </footer>
      </div>
    </div>
  );
}
