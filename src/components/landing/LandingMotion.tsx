'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * The landing choreography.
 *
 * The previous pass animated everything by 12-18px over half a second, which
 * measures as motion and reads as nothing. Entrances here travel far enough to
 * register: whole sections arrive from the side, headlines are revealed by a
 * moving mask rather than a fade, media wipes open, chips pop in sequence.
 *
 * Still transform, opacity and clip-path only, so nothing triggers layout, and
 * the whole thing is skipped under prefers-reduced-motion.
 *
 * ORDER MATTERS: this file HIDES things and then reveals them. Nothing is
 * hidden in the stylesheet, and every reveal is fromTo with
 * immediateRender:false -- so a trigger that never resolves leaves content
 * visible rather than deleted. That mistake has cost this page its primary CTA
 * and both product photographs once already.
 */
export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanups: Array<() => void> = []

    const onScroll = () => {
      const h = document.documentElement
      const fill = document.getElementById('railfill')
      if (fill) fill.style.height = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`
      // The header condenses once you leave the hero.
      document.querySelector('.topnav')?.classList.toggle('stuck', h.scrollTop > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    cleanups.push(() => window.removeEventListener('scroll', onScroll))

    if (reduce) return () => cleanups.forEach(f => f())

    // Magnetic buttons.
    document.querySelectorAll<HTMLElement>('.btn').forEach(btn => {
      const move = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect()
        btn.style.transform =
          `translate(${(e.clientX - (r.left + r.width / 2)) * 0.2}px,` +
          `${(e.clientY - (r.top + r.height / 2)) * 0.3}px)`
      }
      const leave = () => { btn.style.transform = '' }
      btn.addEventListener('pointermove', move)
      btn.addEventListener('pointerleave', leave)
      cleanups.push(() => {
        btn.removeEventListener('pointermove', move)
        btn.removeEventListener('pointerleave', leave)
      })
    })

    const ctx = gsap.context(() => {
      gsap.registerPlugin(ScrollTrigger)
      const small = window.matchMedia('(max-width:820px)').matches
      const far = small ? 40 : 110          // how far things travel in

      // ── HERO ────────────────────────────────────────────────────────
      for (const [sel, dur] of [['#mine', 1.5], ['#theirs', 1.8]] as const) {
        const el = document.querySelector(sel) as SVGPathElement | null
        if (!el) continue
        const L = el.getTotalLength()
        gsap.set(el, { strokeDasharray: L, strokeDashoffset: L })
        gsap.to(el, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', delay: 0.15 })
      }

      // The headline is revealed line by line by a mask that slides off it,
      // which reads as the words arriving rather than appearing.
      const lines = document.querySelectorAll<HTMLElement>('#h1 .ln i')
      const tl = gsap.timeline({ delay: 0.3 })
      tl.fromTo('#hpill',
        { opacity: 0, y: -22, scale: .9 },
        { opacity: 1, y: 0, scale: 1, duration: .6, ease: 'back.out(1.7)', immediateRender: false })
      if (lines.length) {
        tl.fromTo(lines,
          { yPercent: 118, rotate: 4 },
          { yPercent: 0, rotate: 0, duration: 1.05, stagger: .11, ease: 'expo.out', immediateRender: false }, '-=.32')
      }
      tl.fromTo('#hsub', { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: .7, ease: 'power3.out', immediateRender: false }, '-=.6')
        .fromTo('#hcta > *', { opacity: 0, y: 34, scale: .94 },
          { opacity: 1, y: 0, scale: 1, duration: .6, stagger: .11, ease: 'back.out(1.5)', immediateRender: false }, '-=.42')
        .fromTo('#hnote', { opacity: 0 },
          { opacity: 1, duration: .5, immediateRender: false }, '-=.3')

      // The stage lifts in with a slight rotation, then the pins land on it.
      gsap.fromTo('#hframe',
        { y: small ? 60 : 130, opacity: 0, rotateX: small ? 0 : 14, scale: .95 },
        { y: 0, opacity: 1, rotateX: 0, scale: 1, duration: 1.35, ease: 'expo.out',
          delay: .62, immediateRender: false })
      gsap.fromTo('.pin', { opacity: 0, scale: .6 },
        { opacity: 1, scale: 1, duration: .5, stagger: .08, ease: 'back.out(2.2)',
          delay: 1.5, immediateRender: false })

      // The price lines drift as you scroll -- cheap parallax, real depth.
      gsap.to('#duel', {
        yPercent: 26, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 },
      })

      // ── CUSTOMER WALL ───────────────────────────────────────────────
      gsap.fromTo('.wall span',
        { opacity: 0, y: 26, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: .65, stagger: .06,
          ease: 'power3.out', immediateRender: false,
          scrollTrigger: { trigger: '#proof', start: 'top 88%', once: true } })

      // ── CHAPTERS: alternate sides, travel far enough to notice ──────
      gsap.utils.toArray<HTMLElement>('.chapter').forEach((sec, i) => {
        const dir = i % 2 === 0 ? -1 : 1
        gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 74%', once: true } })
          .fromTo(sec.querySelector('.chead'),
            { opacity: 0, x: dir * far * .5 },
            { opacity: 1, x: 0, duration: .7, ease: 'expo.out', immediateRender: false }, 0)
          .fromTo(sec.querySelector('.h2'),
            { opacity: 0, x: dir * far, rotate: dir * 1.4 },
            { opacity: 1, x: 0, rotate: 0, duration: .95, ease: 'expo.out', immediateRender: false }, .06)
          .fromTo(sec.querySelector('.lede'),
            { opacity: 0, x: dir * far * .6 },
            { opacity: 1, x: 0, duration: .8, ease: 'expo.out', immediateRender: false }, .16)
          .fromTo(sec.querySelectorAll('.cpoint'),
            { opacity: 0, y: 40, scale: .95 },
            { opacity: 1, y: 0, scale: 1, duration: .6, stagger: .1, ease: 'back.out(1.4)', immediateRender: false }, .3)
          .fromTo(sec.querySelectorAll('.chip'),
            { opacity: 0, y: 18, scale: .8 },
            { opacity: 1, y: 0, scale: 1, duration: .42, stagger: .035, ease: 'back.out(2)', immediateRender: false }, .5)
          // The media wipes open from the leading edge rather than fading.
          .fromTo(sec.querySelector('.cmedia'),
            { opacity: 0, clipPath: dir < 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)', y: 30 },
            { opacity: 1, clipPath: 'inset(0 0% 0 0%)', y: 0, duration: 1.1, ease: 'expo.out', immediateRender: false }, .55)
          .fromTo(sec.querySelector('.clink'),
            { opacity: 0, x: -18 },
            { opacity: 1, x: 0, duration: .5, ease: 'power3.out', immediateRender: false }, .95)

        // The watermark drifts through the section as you pass it.
        const vis = sec.querySelector('.cvis')
        if (vis) gsap.fromTo(vis, { y: -30 }, {
          y: 30, ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: .8 },
        })
      })

      // ── QUOTES: scale up out of a blur ──────────────────────────────
      gsap.utils.toArray<HTMLElement>('.quote').forEach(q => {
        gsap.timeline({ scrollTrigger: { trigger: q, start: 'top 82%', once: true } })
          .fromTo(q.querySelector('.qmark'),
            { opacity: 0, scale: .3, rotate: -25 },
            { opacity: .5, scale: 1, rotate: 0, duration: .7, ease: 'back.out(2.5)', immediateRender: false }, 0)
          .fromTo(q.querySelector('blockquote'),
            { opacity: 0, scale: .93, filter: 'blur(9px)' },
            { opacity: 1, scale: 1, filter: 'blur(0px)', duration: .95, ease: 'expo.out', immediateRender: false }, .12)
          .fromTo(q.querySelector('.qwho'),
            { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: .6, ease: 'power3.out', immediateRender: false }, .4)
      })

      // ── STORIES: a staggered cascade ────────────────────────────────
      gsap.fromTo('.scard',
        { opacity: 0, y: 54, scale: .93, rotate: -1.2 },
        { opacity: 1, y: 0, scale: 1, rotate: 0, duration: .8, ease: 'expo.out',
          stagger: { each: .07, from: 'start' }, immediateRender: false,
          scrollTrigger: { trigger: '#storiesSec', start: 'top 76%', once: true } })

      // ── NUMBERS ─────────────────────────────────────────────────────
      gsap.fromTo('.nbox',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: .7, stagger: .1, ease: 'expo.out', immediateRender: false,
          scrollTrigger: { trigger: '#numsSec', start: 'top 78%', once: true } })
      // The markup already holds the real figure. Zero it, then count back up,
      // so reduced motion and a failed bundle both leave the truth on screen.
      document.querySelectorAll<HTMLElement>('.nbox b').forEach(el => {
        const end = Number(el.dataset.c ?? 0)
        const suffix = el.dataset.s ?? ''
        el.textContent = `0${suffix}`
        const o = { v: 0 }
        gsap.to(o, {
          v: end, duration: 1.8, ease: 'power2.out',
          scrollTrigger: { trigger: '#numsSec', start: 'top 72%', once: true },
          onUpdate: () => { el.textContent = `${Math.round(o.v).toLocaleString('en-GB')}${suffix}` },
        })
      })

      // ── PRICING: the tiers deal in like cards ───────────────────────
      gsap.fromTo('.ptier',
        { opacity: 0, y: 70, rotate: (i: number) => (i - 1) * 2.5, scale: .92 },
        { opacity: 1, y: 0, rotate: 0, scale: 1, duration: .85, stagger: .1,
          ease: 'expo.out', immediateRender: false,
          scrollTrigger: { trigger: '#pricingSec', start: 'top 76%', once: true } })

      // ── FAQ + FOOTER ────────────────────────────────────────────────
      gsap.fromTo('.qitem',
        { opacity: 0, x: -34 },
        { opacity: 1, x: 0, duration: .6, stagger: .07, ease: 'expo.out', immediateRender: false,
          scrollTrigger: { trigger: '#faqSec', start: 'top 80%', once: true } })
      gsap.fromTo('.footcol, .footbrand',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: .7, stagger: .08, ease: 'power3.out', immediateRender: false,
          scrollTrigger: { trigger: 'footer', start: 'top 88%', once: true } })

      // Section headings that are not inside a chapter still deserve an entry.
      gsap.utils.toArray<HTMLElement>('.band').forEach(band => {
        if (band.classList.contains('chapter') || band.classList.contains('quote')) return
        const head = band.querySelectorAll(':scope > .eyebrow, :scope > .h2, :scope > .lede')
        if (!head.length) return
        gsap.fromTo(head,
          { opacity: 0, y: 34 },
          { opacity: 1, y: 0, duration: .75, stagger: .09, ease: 'expo.out', immediateRender: false,
            scrollTrigger: { trigger: band, start: 'top 80%', once: true } })
      })
    })

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    cleanups.push(() => window.removeEventListener('load', refresh))
    if (document.readyState === 'complete') requestAnimationFrame(refresh)

    return () => { ctx.revert(); cleanups.forEach(f => f()) }
  }, [])

  return null
}
