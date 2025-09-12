'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * All landing-page choreography, in one client component.
 *
 * The markup stays a server component; this attaches behaviour to it by id.
 * Everything animates transform and opacity only, so nothing here triggers
 * layout. Every effect is gated on prefers-reduced-motion, and the static page
 * underneath is the reduced-motion design rather than a broken version of the
 * animated one.
 */
const ROWS = [
  { n: 'Northwind — ErgoMesh Office Chair', from: '8900', to: '7990' },
  { n: 'Halden — Standing Desk 140×70', from: '34900', to: '36900' },
  { n: 'Vessel — Oak Shelf Unit, 5 Tier', from: '12995', to: '10995' },
]

export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      // ---- split-flap board ------------------------------------------------
      const board = document.getElementById('board')
      if (board) {
        board.innerHTML = ''
        for (const r of ROWS) {
          const row = document.createElement('div')
          row.className = 'brow'
          let f = ''
          r.from.split('').forEach((c, i) => {
            f += `<span class="flap">${c}</span>`
            if (i === r.from.length - 3) f += '<span class="flap dot">.</span>'
          })
          row.innerHTML = `<span class="n">${r.n}</span><span class="flaps">${f}</span>`
          board.appendChild(row)
        }
      }

      const flip = (el: HTMLElement, ch: string): Promise<unknown> => {
        if (reduce) { el.textContent = ch; return Promise.resolve() }
        return el.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(-90deg)' }],
          { duration: 55, easing: 'ease-in' }).finished.then(() => {
            el.textContent = ch
            return el.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }],
              { duration: 55, easing: 'ease-out' }).finished
          })
      }

      const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

      const runBoard = async () => {
        if (!board) return
        for (let i = 0; i < ROWS.length; i++) {
          const row = board.children[i] as HTMLElement
          const flaps = Array.from(row.querySelectorAll<HTMLElement>('.flap'))
            .filter(x => !x.classList.contains('dot'))
          const target = ROWS[i].to.split('')
          flaps.forEach(async (el, j) => {
            await wait(j * 65)
            const n = 3 + Math.floor(Math.random() * 4)
            for (let k = 0; k < n; k++) await flip(el, String(Math.floor(Math.random() * 10)))
            await flip(el, target[j])
            if (j === flaps.length - 1) row.querySelector('.flaps')?.classList.add('hit')
          })
          await wait(400)
        }
      }
      const boardTimer = setTimeout(runBoard, 600)

      // ---- magnetic buttons ------------------------------------------------
      const cleanups: Array<() => void> = [() => clearTimeout(boardTimer)]
      if (!reduce) {
        document.querySelectorAll<HTMLElement>('.btn').forEach(btn => {
          const move = (e: PointerEvent) => {
            const r = btn.getBoundingClientRect()
            btn.style.transform =
              `translate(${(e.clientX - (r.left + r.width / 2)) * 0.3}px,` +
              `${(e.clientY - (r.top + r.height / 2)) * 0.4}px)`
          }
          const leave = () => { btn.style.transform = '' }
          btn.addEventListener('pointermove', move)
          btn.addEventListener('pointerleave', leave)
          cleanups.push(() => {
            btn.removeEventListener('pointermove', move)
            btn.removeEventListener('pointerleave', leave)
          })
        })
      }

      // ---- scroll progress rail, read as a price axis ----------------------
      const onScroll = () => {
        const h = document.documentElement
        const fill = document.getElementById('railfill')
        if (fill) fill.style.height =
          `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      cleanups.push(() => window.removeEventListener('scroll', onScroll))

      if (reduce) return () => cleanups.forEach(f => f())

      gsap.registerPlugin(ScrollTrigger)

      // ---- the un-tilt -----------------------------------------------------
      gsap.to('#device', {
        rotateX: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: '#tiltSec', start: 'top 85%', end: 'top 15%', scrub: 0.7 },
      })

      // ---- matching: in from left and right, rotating, then locking --------
      const small = window.matchMedia('(max-width:820px)').matches
      gsap.set('#cardL', { xPercent: small ? -40 : -115, rotate: -11, opacity: 0 })
      gsap.set('#cardR', { xPercent: small ? 40 : 115, rotate: 11, opacity: 0 })
      gsap.timeline({
        scrollTrigger: { trigger: '#matchSec', start: 'top 70%', end: 'center 45%', scrub: 0.9 },
      })
        .to('#cardL', { xPercent: 0, rotate: 0, opacity: 1, ease: 'power2.out' }, 0)
        .to('#cardR', { xPercent: 0, rotate: 0, opacity: 1, ease: 'power2.out' }, 0)

      // ---- confidence counts up once the pair is on screen -----------------
      const s = { v: 0 }
      let seen = false
      const matchSec = document.getElementById('matchSec')
      if (matchSec) {
        const io = new IntersectionObserver(entries => {
          for (const e of entries) {
            if (!e.isIntersecting || seen) continue
            seen = true
            gsap.to(s, {
              v: 0.94, duration: 1.5, delay: 0.5, ease: 'power2.out',
              onUpdate: () => {
                const el = document.getElementById('score')
                if (el) el.textContent = s.v.toFixed(2)
              },
              onComplete: () => {
                const el = document.getElementById('verdict')
                if (el) el.textContent = 'locked'
              },
            })
          }
        }, { threshold: 0.5 })
        io.observe(matchSec)
        cleanups.push(() => io.disconnect())
      }

      return () => cleanups.forEach(f => f())
    })

    return () => ctx.revert()
  }, [])

  return null
}
