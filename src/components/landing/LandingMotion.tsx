'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * The landing choreography, rebuilt for the chapter skeleton.
 *
 * Everything animates transform or opacity, so nothing here triggers layout.
 * Under prefers-reduced-motion the function returns before registering a
 * single ScrollTrigger, and the page is then the static design rather than a
 * frozen animation.
 *
 * ORDER MATTERS: this file HIDES things and then reveals them. Nothing is
 * hidden in the stylesheet. Hiding in CSS and revealing here means any failure
 * -- a bundle that never loads, a trigger whose start never resolves -- leaves
 * the content gone permanently. That mistake has already cost this page the
 * primary CTA and both product photographs once; hence fromTo with
 * immediateRender:false everywhere below, so the worst case is an animation
 * that does not play rather than content that does not exist.
 */
export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanups: Array<() => void> = []

    // Scroll rail, read as a price axis.
    const onScroll = () => {
      const h = document.documentElement
      const fill = document.getElementById('railfill')
      if (fill) fill.style.height = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    cleanups.push(() => window.removeEventListener('scroll', onScroll))

    if (reduce) return () => cleanups.forEach(f => f())

    // Magnetic buttons.
    document.querySelectorAll<HTMLElement>('.btn').forEach(btn => {
      const move = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect()
        btn.style.transform =
          `translate(${(e.clientX - (r.left + r.width / 2)) * 0.18}px,` +
          `${(e.clientY - (r.top + r.height / 2)) * 0.26}px)`
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

      // ---- hero: the two lines plot themselves, then the copy lands ----
      for (const [sel, dur] of [['#mine', 1.4], ['#theirs', 1.65]] as const) {
        const el = document.querySelector(sel) as SVGPathElement | null
        if (!el) continue
        const L = el.getTotalLength()
        gsap.set(el, { strokeDasharray: L, strokeDashoffset: L })
        gsap.to(el, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', delay: 0.2 })
      }

      gsap.timeline({ delay: 0.35 })
        .fromTo('#hpill', { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: .5, ease: 'power2.out', immediateRender: false })
        .fromTo('#h1', { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: .75, ease: 'power3.out', immediateRender: false }, '-=.28')
        .fromTo('#hsub', { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: .6, ease: 'power3.out', immediateRender: false }, '-=.48')
        .fromTo(['#hcta', '#hnote'], { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: .55, stagger: .07, ease: 'power3.out', immediateRender: false }, '-=.38')

      // ---- the product frame rises out of the fold ----
      gsap.fromTo('#hframe',
        { y: small ? 26 : 56, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: .7, immediateRender: false })

      // ---- customer wall types itself in ----
      gsap.fromTo('.wall span', { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: .5, stagger: .045, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: '#proof', start: 'top 88%', once: true } })

      // ---- chapters: the heading, then the points, one at a time ----
      gsap.utils.toArray<HTMLElement>('.chapter').forEach(sec => {
        gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 76%', once: true } })
          .fromTo(sec.querySelectorAll('.chead, .h2, .lede'),
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: .65, stagger: .08, ease: 'power3.out', immediateRender: false }, 0)
          .fromTo(sec.querySelectorAll('.cpoint'),
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: .55, stagger: .09, ease: 'power3.out', immediateRender: false }, .3)
      })

      // ---- quote bands ----
      gsap.utils.toArray<HTMLElement>('.quote').forEach(q => {
        gsap.fromTo(q.children,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: .6, stagger: .1, ease: 'power3.out',
            immediateRender: false,
            scrollTrigger: { trigger: q, start: 'top 80%', once: true } })
      })

      // ---- the numbers count ----
      // The markup already holds the real figure. Zero it here, then count
      // back up to it -- so reduced motion, a failed bundle or no JavaScript
      // at all leaves the true number on screen rather than a zero.
      document.querySelectorAll<HTMLElement>('.nbox b').forEach(el => {
        const end = Number(el.dataset.c ?? 0)
        const suffix = el.dataset.s ?? ''
        el.textContent = `0${suffix}`
        const o = { v: 0 }
        gsap.to(o, {
          v: end, duration: 1.4, ease: 'power2.out',
          scrollTrigger: { trigger: '#numsSec', start: 'top 72%', once: true },
          onUpdate: () => {
            el.textContent = `${Math.round(o.v).toLocaleString('en-GB')}${suffix}`
          },
        })
      })

      // ---- pricing tiers ----
      gsap.fromTo('.ptier', { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: .65, stagger: .09, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: '#pricingSec', start: 'top 74%', once: true } })
    })

    // Fonts and images both change document height after first paint, and
    // ScrollTrigger measured before either settled.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    cleanups.push(() => window.removeEventListener('load', refresh))
    if (document.readyState === 'complete') requestAnimationFrame(refresh)

    return () => { ctx.revert(); cleanups.forEach(f => f()) }
  }, [])

  return null
}
