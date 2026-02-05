'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * What JavaScript still has to do.
 *
 * The section reveals used to live here: alternating 110px horizontal slides
 * fired by ScrollTrigger. They are now in src/app/motion.css as native
 * scroll-driven animations, which are scrubbed by the scroll position instead
 * of playing on their own clock, and run off the main thread. This file is
 * what CSS cannot express:
 *
 *   · the opening timeline, which is time-based rather than scroll-based --
 *     the hero is already on screen at load, so a view() timeline would sit
 *     past its own entry range and do nothing;
 *   · drawing the two SVG price paths, which needs getTotalLength();
 *   · counting the figures up, which needs to write text;
 *   · the pointer-reactive bits, which have no timeline at all.
 *
 * When the browser has no scroll-driven animations, `fallback()` runs the same
 * vocabulary through ScrollTrigger -- rise, de-blur, settle -- so the page has
 * one choreography rather than two. Nothing anywhere travels sideways.
 *
 * ORDER MATTERS: every reveal is fromTo with immediateRender:false, so a
 * trigger that never resolves leaves the content visible rather than hidden.
 * That mistake has cost this page its primary CTA and both product
 * photographs once already.
 */

// Support is Chrome/Edge 115+, Safari 26+, Firefox 144+. Everything else takes
// the ScrollTrigger path below.
const NATIVE_SCROLL_ANIM =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline', 'view()')

export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanups: Array<() => void> = []

    // The header condenses once you leave the hero. Still a listener: the nav
    // is position:fixed, so scroll-state container queries do not see it.
    const onScroll = () => {
      const h = document.documentElement
      document.querySelector('.topnav')?.classList.toggle('stuck', h.scrollTop > 40)
      // Only when the rail is not already being driven by scroll(root block).
      if (!NATIVE_SCROLL_ANIM) {
        const fill = document.getElementById('railfill')
        if (fill) fill.style.height = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    cleanups.push(() => window.removeEventListener('scroll', onScroll))

    if (reduce) return () => cleanups.forEach(f => f())

    // Blur, kept -- but off the scroll timeline. `.motion-ready` is what turns
    // the initial blur on at all, so a page whose bundle never runs is never
    // left holding blurred content. The observer then flips each element sharp
    // exactly once, 700ms of repaint rather than one per scroll frame.
    const root = document.documentElement

    // A scroll-driven reveal needs something to scroll. When the document is
    // no taller than the window -- which is exactly what a full-page screenshot
    // does, by resizing the viewport to the document height -- every view()
    // timeline goes inactive at once and the fill holds the whole page at
    // opacity 0. Watch for it and opt out rather than render a blank page.
    const checkScroll = () => root.classList.toggle(
      'no-scroll', root.scrollHeight <= root.clientHeight + 120)
    checkScroll()
    const ro = new ResizeObserver(checkScroll)
    ro.observe(document.body)
    cleanups.push(() => { ro.disconnect(); root.classList.remove('no-scroll') })

    root.classList.add('motion-ready')
    cleanups.push(() => root.classList.remove('motion-ready'))

    const soft = document.querySelectorAll<HTMLElement>('.chapter .h2, .cmedia, .quote blockquote')
    soft.forEach(el => el.classList.add('soft-in'))
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('soft-seen')
        io.unobserve(e.target)          // one-shot, by construction
      }
    }, { rootMargin: '0px 0px -12% 0px' })
    soft.forEach(el => io.observe(el))
    cleanups.push(() => {
      io.disconnect()
      soft.forEach(el => el.classList.remove('soft-in', 'soft-seen'))
    })

    // Magnetic buttons. The vertical pull was 0.3 of the cursor offset, which
    // is enough to slide a button out from under the pointer that is chasing
    // it; both axes are now the same modest fraction, and the return is eased
    // rather than snapped.
    document.querySelectorAll<HTMLElement>('.btn').forEach(btn => {
      const move = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect()
        gsap.to(btn, {
          x: (e.clientX - (r.left + r.width / 2)) * 0.16,
          y: (e.clientY - (r.top + r.height / 2)) * 0.16,
          duration: 0.4, ease: 'power3.out',
        })
      }
      const leave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.5)' })
      btn.addEventListener('pointermove', move)
      btn.addEventListener('pointerleave', leave)
      cleanups.push(() => {
        btn.removeEventListener('pointermove', move)
        btn.removeEventListener('pointerleave', leave)
        gsap.killTweensOf(btn)
      })
    })

    const ctx = gsap.context(() => {
      gsap.registerPlugin(ScrollTrigger)

      // ── THE OPENING ─────────────────────────────────────────────────
      // Time-based, because all of it is on screen at load.

      // The two price paths draw themselves.
      //
      // The dash length CANNOT be getTotalLength(). These paths carry
      // vector-effect: non-scaling-stroke -- they have to, because the SVG
      // uses preserveAspectRatio="none" and a scaled stroke would be thicker
      // across than down -- and under that rule the browser measures dashes in
      // SCREEN pixels while getTotalLength() reports VIEWBOX units. On a 1440
      // viewBox stretched across a 2200px window the on-screen path is far
      // longer than the 1528-unit dash, so the stroke drew 1528 screen-pixels,
      // hit the gap, and stopped dead in the middle of the page. It looked
      // fine at 1440 and got worse the wider the display, which is exactly the
      // shape of bug that survives being tested on one laptop.
      //
      // So: walk the path, push each sample through the element's screen CTM,
      // and sum the real on-screen distance.
      const screenLength = (el: SVGPathElement) => {
        const ctm = el.getScreenCTM()
        const total = el.getTotalLength()
        if (!ctm || !total) return total
        const svg = el.ownerSVGElement!
        const at = (d: number) => {
          const pt = svg.createSVGPoint()
          const p0 = el.getPointAtLength(d)
          pt.x = p0.x; pt.y = p0.y
          return pt.matrixTransform(ctm)
        }
        const STEPS = 160
        let sum = 0
        let prev = at(0)
        for (let i = 1; i <= STEPS; i++) {
          const cur = at((total * i) / STEPS)
          sum += Math.hypot(cur.x - prev.x, cur.y - prev.y)
          prev = cur
        }
        return sum
      }

      for (const [sel, dur] of [['#mine', 1.6], ['#theirs', 2.1]] as const) {
        const el = document.querySelector(sel) as SVGPathElement | null
        if (!el) continue
        const L = screenLength(el)
        gsap.set(el, { strokeDasharray: L, strokeDashoffset: L })
        gsap.to(el, {
          strokeDashoffset: 0, duration: dur, ease: 'power2.inOut', delay: 0.2,
          // Clear the dash once drawn. A resting line should be a line, not a
          // dash pattern that happens to be showing its first segment -- and
          // this way a resize after the draw cannot reintroduce the gap.
          onComplete: () => gsap.set(el, { strokeDasharray: 'none', strokeDashoffset: 0 }),
        })
      }

      // The crossing lands after both lines have passed through it.
      gsap.fromTo('#xpt',
        { opacity: 0, scale: 0 },
        { opacity: .9, scale: 1, duration: .7, ease: 'back.out(3)',
          delay: 1.5, immediateRender: false })

      // The headline is revealed line by line by a mask sliding off it: the
      // words arrive from behind the line above rather than fading up into
      // place. Each line is set slightly heavier than the one before lands,
      // which is what makes a stagger read as one gesture instead of three.
      const lines = document.querySelectorAll<HTMLElement>('#h1 .ln i')
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.25 })
      tl.fromTo('#hpill',
        { opacity: 0, y: -14, scale: .94 },
        { opacity: 1, y: 0, scale: 1, duration: .7, ease: 'back.out(2)', immediateRender: false })
      if (lines.length) {
        tl.fromTo(lines,
          { yPercent: 112, skewY: 2.5 },
          { yPercent: 0, skewY: 0, duration: 1.15, stagger: .085, immediateRender: false }, '-=.4')
      }
      tl.fromTo('#hsub', { opacity: 0, y: 22, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: .9, immediateRender: false }, '-=.75')
        .fromTo('#hcta > *', { opacity: 0, y: 20, scale: .96 },
          { opacity: 1, y: 0, scale: 1, duration: .7, stagger: .08,
            ease: 'back.out(1.6)', immediateRender: false }, '-=.6')
        .fromTo('#hnote', { opacity: 0 },
          { opacity: 1, duration: .6, immediateRender: false }, '-=.4')

      // The stage rises out of a slight over-scale and blur -- the same
      // "settle" gesture the section media uses further down the page, so the
      // opening and the body share a vocabulary.
      gsap.fromTo('#hframe',
        { y: 56, opacity: 0, scale: .90, filter: 'blur(12px)' },
        { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.4,
          ease: 'expo.out', delay: .5, immediateRender: false })
      gsap.fromTo('.pin', { opacity: 0, y: 8, scale: .82 },
        { opacity: 1, y: 0, scale: 1, duration: .55, stagger: .07,
          ease: 'back.out(2.4)', delay: 1.35, immediateRender: false })

      // Depth in the hero: the price lines fall behind the copy as you leave.
      gsap.to('#duel', {
        yPercent: 22, opacity: .18, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .5 },
      })

      // ── FIGURES ─────────────────────────────────────────────────────
      // The markup already holds the real figure. Zero it, then count back
      // up, so reduced motion and a failed bundle both leave the truth on
      // screen rather than a placeholder.
      document.querySelectorAll<HTMLElement>('.nbox b').forEach(el => {
        const end = Number(el.dataset.c ?? 0)
        const suffix = el.dataset.s ?? ''
        el.textContent = `0${suffix}`
        const o = { v: 0 }
        gsap.to(o, {
          v: end, duration: 1.9, ease: 'power2.out',
          scrollTrigger: { trigger: '#numsSec', start: 'top 72%', once: true },
          onUpdate: () => { el.textContent = `${Math.round(o.v).toLocaleString('en-GB')}${suffix}` },
        })
      })

      if (!NATIVE_SCROLL_ANIM) fallback()
    })

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    cleanups.push(() => window.removeEventListener('load', refresh))
    if (document.readyState === 'complete') requestAnimationFrame(refresh)

    return () => { ctx.revert(); cleanups.forEach(f => f()) }
  }, [])

  return null
}

/**
 * The ScrollTrigger mirror of motion.css, for browsers without
 * `animation-timeline`. Same gestures, same distances, same budget: transform
 * and opacity only, never a scrubbed filter or clip-path. The point is that
 * nobody can tell which path they are on.
 *
 * `start`/`end` are expressed against the viewport bottom so the reveal
 * finishes a fixed distance after the element appears, which is the same
 * screen-size independence the px ranges buy in the CSS.
 */
function fallback() {
  const grow = { opacity: 0, y: 34, scale: .90 }
  const rise = { opacity: 0, y: 30, scale: .94 }
  const text = { opacity: 0, y: 16, scale: .985 }
  const pop  = { opacity: 0, y: 10, scale: .86 }
  const down = { opacity: 0, y: 0,  scale: 1.10 }

  // A decelerating scrub: most of the movement happens in the first third of
  // the range, so nothing sits half-arrived in the middle of the screen.
  const EASE = 'power3.out'

  const reveal = (sel: string, from: gsap.TweenVars, travel = 320) => {
    gsap.utils.toArray<HTMLElement>(sel).forEach(el => {
      gsap.fromTo(el, from,
        { opacity: 1, y: 0, scale: 1, ease: EASE, immediateRender: false,
          scrollTrigger: { trigger: el, start: 'top bottom', end: `top bottom-=${travel}`, scrub: .5 } })
    })
  }

  reveal('.band:not(.hero) .eyebrow, .band:not(.hero) .chiptitle', text, 220)
  reveal('.chapter .chead', text, 200)
  reveal('.band:not(.hero) > .h2, .chapter .h2', rise, 300)
  reveal('.band:not(.hero) > .lede, .chapter .lede', text, 300)
  reveal('.cpoint', grow, 330)
  reveal('.chip', pop, 240)
  reveal('.cmedia', grow, 430)
  reveal('.clink', text, 280)
  reveal('.scard, .ptier, .nbox, .qitem', grow, 340)
  reveal('.wall span', pop, 210)
  reveal('.quote .qmark', down, 240)
  reveal('.quote blockquote', rise, 360)
  reveal('.quote .qwho', text, 380)
  reveal('.footcol, .footbrand', text, 190)

  // The chapter hairline draws across.
  gsap.utils.toArray<HTMLElement>('.chapter .chead').forEach(el => {
    gsap.fromTo(el, { '--rule-scale': 0 },
      { '--rule-scale': 1, ease: EASE, immediateRender: false,
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'top bottom-=340', scrub: .5 } })
  })

  // Watermark parallax, across the whole time the chapter is on screen.
  gsap.utils.toArray<HTMLElement>('.cvis').forEach(el => {
    gsap.fromTo(el, { yPercent: -7 }, { yPercent: 7, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: el.closest('.chapter') ?? el,
                       start: 'top bottom', end: 'bottom top', scrub: .8 } })
  })
}
