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

    if (reduce) {
      document.querySelectorAll<HTMLElement>('.frow,.out').forEach(e => { e.style.opacity = '1' })
      return () => cleanups.forEach(f => f())
    }

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
        .to('.frow', { opacity: 1, duration: 0.1, stagger: 0.1 }, 0)

      // 3 — the two listings travel in, rotate, and lock.
      const small = window.matchMedia('(max-width:820px)').matches
      gsap.set('#cardL', { xPercent: small ? -35 : -110, rotate: -10, opacity: 0 })
      gsap.set('#cardR', { xPercent: small ? 35 : 110, rotate: 10, opacity: 0 })
      gsap.timeline({
        scrollTrigger: { trigger: '#matchSec', start: 'top 72%', end: 'center 48%', scrub: 0.9 },
      })
        .to('#cardL', { xPercent: 0, rotate: 0, opacity: 1, ease: 'power2.out' }, 0)
        .to('#cardR', { xPercent: 0, rotate: 0, opacity: 1, ease: 'power2.out' }, 0)

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
        .fromTo('#out1', { opacity: 0, x: 34, rotate: 2 },
          { opacity: 1, x: 0, rotate: 0, duration: 0.55, ease: 'power3.out' })
        .fromTo('#out2', { opacity: 0, x: 34, rotate: 2 },
          { opacity: 1, x: 0, rotate: 0, duration: 0.55, ease: 'power3.out' }, '-=.3')

      // 5 — the interface stands up and the figures count.
      gsap.to('#device', {
        rotateX: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: '#revSec', start: 'top 85%', end: 'top 18%', scrub: 0.7 },
      })
      document.querySelectorAll<HTMLElement>('.k .v').forEach(el => {
        const o = { v: 0 }
        const end = Number(el.dataset.c ?? 0)
        const suffix = el.dataset.s ?? ''
        gsap.to(o, {
          v: end, duration: 1.3, ease: 'power2.out',
          scrollTrigger: { trigger: '#revSec', start: 'top 45%' },
          onUpdate: () => { el.textContent = `${Math.round(o.v)}${suffix}` },
        })
      })
    })

    return () => { ctx.revert(); cleanups.forEach(f => f()) }
  }, [])

  return null
}
