'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * The whole landing choreography.
 *
 * Everything animates transform, opacity or stroke-dashoffset, so nothing here
 * triggers layout. Under prefers-reduced-motion the function fills the two
 * JS-rendered lists and returns before registering a single ScrollTrigger --
 * the page is then the static design, not a frozen animation.
 *
 * ORDER MATTERS: this file HIDES things and then reveals them. Nothing is
 * hidden in the stylesheet. Hiding in CSS and revealing here means any failure
 * -- a bundle that never loads, a ScrollTrigger whose start never resolves --
 * leaves the content gone permanently. It cost the primary CTA and both
 * product photographs before this was turned round.
 */
const FEED: Array<[string, string, string, boolean]> = [
  ['02:04', 'Northwind — ErgoMesh', '79.90', true],
  ['02:31', 'Halden — Task Chair', '92.50', false],
  ['03:14', 'Northwind — undercut', '79.90', true],
  ['03:16', 'Halden — Standing Desk', '369.00', false],
  ['03:19', 'Vessel — Oak Shelf', '109.95', false],
  ['04:02', 'Vessel — Brass Lamp', '44.00', false],
  ['04:47', '312 listings closed', '—', false],
]

const TAPE: Array<[string, string, string, string]> = [
  ['Northwind', 'ErgoMesh Office Chair', '−10.2%', 'c'],
  ['Halden', 'Standing Desk 140×70', '+5.7%', 'w'],
  ['Vessel', 'Oak Shelf Unit', '−15.4%', 'c'],
  ['Northwind', 'Brass Desk Lamp', 'new', ''],
  ['Halden', 'Task Chair Mesh', 'out of stock', 'w'],
  ['Vessel', 'Wall Mirror, Round', '−4.1%', ''],
  ['Northwind', 'Desk Mat, Felt', '+2.0%', ''],
  ['Halden', 'Monitor Arm', 'back in stock', 'w'],
]

export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const $ = (s: string) => document.querySelector<HTMLElement>(s)

    // ---- content that only exists as data ---------------------------------
    const feed = document.getElementById('feed')
    if (feed) {
      feed.innerHTML = FEED.map(([t, label, v, hot]) =>
        `<div class="frow${hot ? ' hot' : ''}"><span class="t">${t}</span>` +
        `<span>${label}</span><span class="v">${v}</span></div>`).join('')
    }
    const tape = document.getElementById('tape')
    if (tape) {
      // Rendered twice so a -50% loop is seamless.
      const once = TAPE.map(([store, item, delta, cls]) =>
        `<li class="${cls}"><i></i><span>${store} &middot; ${item}</span><b>${delta}</b></li>`).join('')
      tape.innerHTML = once + once
    }

    const cleanups: Array<() => void> = []

    // ---- scroll rail, read as a price axis ---------------------------------
    const onScroll = () => {
      const h = document.documentElement
      const fill = document.getElementById('railfill')
      if (fill) fill.style.height = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    cleanups.push(() => window.removeEventListener('scroll', onScroll))

    // Nothing is hidden by default any more, so reduced motion just leaves.
    if (reduce) return () => cleanups.forEach(f => f())

    // ---- magnetic buttons ---------------------------------------------------
    document.querySelectorAll<HTMLElement>('.btn').forEach(btn => {
      const move = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect()
        btn.style.transform =
          `translate(${(e.clientX - (r.left + r.width / 2)) * 0.28}px,` +
          `${(e.clientY - (r.top + r.height / 2)) * 0.38}px)`
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

      // 1 — the lines plot themselves, then cross, then the headline lands.
      for (const [sel, dur] of [['#mine', 1.5], ['#theirs', 1.75]] as const) {
        const el = document.querySelector(sel) as SVGPathElement | null
        if (!el) continue
        const L = el.getTotalLength()
        gsap.set(el, { strokeDasharray: L, strokeDashoffset: L })
        gsap.to(el, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', delay: 0.25 })
      }
      gsap.set(['#xpt', '#axis', '#acard', '#hcta'], { opacity: 0 })
      gsap.set('#acard', { y: -8 })
      gsap.timeline({ delay: 1.55 })
        .to('.hero-txt h1 i', { y: '0%', duration: 0.85, stagger: 0.075, ease: 'power3.out' })
        .to(['#xpt', '#axis'], { opacity: 1, duration: 0.4 }, '-=.55')
        .to('#acard', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=.3')
        .to('#hcta', { opacity: 1, duration: 0.4 }, '-=.25')

      // 2 — pinned night run: beams out, rows back, clock through to dawn.
      ;['#p0', '#p1', '#p2'].forEach((sel, i) => {
        const el = document.querySelector(sel) as SVGPathElement | null
        if (!el) return
        const L = el.getTotalLength()
        gsap.set(el, { strokeDashoffset: L })
        gsap.to(el, {
          strokeDashoffset: -L, duration: 2.2, repeat: -1, ease: 'none', delay: i * 0.5,
          scrollTrigger: { trigger: '#night', start: 'top 60%' },
        })
      })
      const st = { v: 0 }
      gsap.timeline({
        scrollTrigger: {
          trigger: '#night', start: 'top top', end: 'bottom bottom',
          scrub: 0.6, pin: '.night-pin', anticipatePin: 1,
        },
      })
        .to(st, {
          v: 1, ease: 'none',
          onUpdate: () => {
            const mins = 120 + st.v * 195
            const h = Math.floor(mins / 60), m = Math.floor(mins % 60), s = Math.floor((mins * 60) % 60)
            const el = document.getElementById('clock')
            if (el) el.innerHTML =
              `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}<b>:${String(s).padStart(2, '0')}</b>`
          },
        }, 0)
        .fromTo('.frow', { opacity: 0 },
          { opacity: 1, duration: 0.1, stagger: 0.1, immediateRender: false }, 0)

      // 3 — the two listings travel in, rotate, and lock.
      const small = window.matchMedia('(max-width:820px)').matches
      const outX = small ? 12 : 34

      // fromTo with immediateRender:false, and no scrub.
      //
      // A bare .from() defaults to immediateRender:true — it stamps opacity 0
      // on the cards the moment the page loads, and ONLY the tween puts it
      // back. When the trigger failed to resolve (the pinned section above
      // changes document height after ScrollTrigger has measured it), both
      // product photographs stayed invisible permanently. immediateRender:false
      // means nothing is touched until the tween actually runs, so the worst
      // case is the animation not playing rather than the content not existing.
      gsap.timeline({
        scrollTrigger: { trigger: '#matchSec', start: 'top 80%', once: true },
      })
        .fromTo('#cardL',
          { xPercent: small ? -35 : -80, rotate: -10, opacity: 0 },
          { xPercent: 0, rotate: 0, opacity: 1, duration: 1, ease: 'power3.out', immediateRender: false }, 0)
        .fromTo('#cardR',
          { xPercent: small ? 35 : 80, rotate: 10, opacity: 0 },
          { xPercent: 0, rotate: 0, opacity: 1, duration: 1, ease: 'power3.out', immediateRender: false }, 0)

      const sc = { v: 0 }
      let seen = false
      const matchSec = document.getElementById('matchSec')
      if (matchSec) {
        const io = new IntersectionObserver(entries => {
          for (const e of entries) {
            if (!e.isIntersecting || seen) continue
            seen = true
            gsap.fromTo(sc, { v: 0 }, {
              v: 0.94, duration: 1.4, delay: 0.45, ease: 'power2.out',
              onUpdate: () => { const el = $('#score'); if (el) el.textContent = sc.v.toFixed(2) },
            })
          }
        }, { threshold: 0.5 })
        io.observe(matchSec)
        cleanups.push(() => io.disconnect())
      }

      // 4 — the tape runs, then one line peels off into email and Slack.
      gsap.to('#tape', { yPercent: -50, duration: 26, ease: 'none', repeat: -1 })
      gsap.timeline({ scrollTrigger: { trigger: '#tickSec', start: 'top 62%' } })
        // The entry offset shrinks on phones. At 34px the card is translated
        // past the right edge of a 360px viewport for the length of the
        // animation, which is enough to flash a horizontal scrollbar -- an
        // overflow that only exists while the tween is running and so never
        // shows up in a static measurement.
        .fromTo('#out1', { opacity: 0, x: outX, rotate: 2 },
          { opacity: 1, x: 0, rotate: 0, duration: 0.55, ease: 'power3.out', immediateRender: false })
        .fromTo('#out2', { opacity: 0, x: outX, rotate: 2 },
          { opacity: 1, x: 0, rotate: 0, duration: 0.55, ease: 'power3.out', immediateRender: false }, '-=.3')

      // 1b — the customer wall types itself in, left to right.
      gsap.fromTo('.wall span',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: .5, stagger: .045, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: '#proof', start: 'top 85%', once: true } })

      // 1c — the two comparison cards arrive from opposite sides, and the
      // live one's log lands a line at a time afterwards. Same fromTo +
      // immediateRender:false rule as everywhere else in this file: a trigger
      // that never resolves must leave the content visible, not delete it.
      gsap.timeline({ scrollTrigger: { trigger: '#vsSec', start: 'top 78%', once: true } })
        .fromTo('#vsA', { opacity: 0, x: small ? -14 : -40 },
          { opacity: 1, x: 0, duration: .7, ease: 'power3.out', immediateRender: false }, 0)
        .fromTo('#vsB', { opacity: 0, x: small ? 14 : 40 },
          { opacity: 1, x: 0, duration: .7, ease: 'power3.out', immediateRender: false }, .1)
        .fromTo('#vsB .vslog li', { opacity: .25 },
          { opacity: 1, duration: .28, stagger: .13, ease: 'none', immediateRender: false }, .55)

      // 6 — the review cards rise, keeping the tilt each one already has.
      gsap.utils.toArray<HTMLElement>('.rcard').forEach((card, i) => {
        const rest = gsap.getProperty(card, 'rotate') as number
        gsap.fromTo(card,
          { opacity: 0, y: 34, rotate: rest },
          { opacity: 1, y: 0, rotate: rest, duration: .7, delay: i * .09,
            ease: 'power3.out', immediateRender: false,
            scrollTrigger: { trigger: '#saysSec', start: 'top 78%', once: true } })
      })

      // 5 — the interface stands up. Only the frame tilts: the tab strip above
      // it is a control surface, and a control you have to read at 40 degrees
      // is a control nobody presses.
      //
      // The figures inside it are counted by ProductTabs, not here. There used
      // to be a GSAP loop over `.k .v` reading a data-c attribute; when the
      // panes moved into React that attribute went away, so the loop read
      // Number(undefined ?? 0) and wrote a confident 0 over every number React
      // had just rendered.
      gsap.to('#frame3d', {
        rotateX: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: '#revSec', start: 'top 85%', end: 'top 18%', scrub: 0.7 },
      })
    })

    // A pinned section and images that decode after first paint both change
    // document height, and ScrollTrigger measured before either settled.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    cleanups.push(() => window.removeEventListener('load', refresh))
    if (document.readyState === 'complete') requestAnimationFrame(refresh)

    return () => { ctx.revert(); cleanups.forEach(f => f()) }
  }, [])

  return null
}
