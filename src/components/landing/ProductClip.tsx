'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  /** Base name in /public/clips — "org-switch" loads org-switch.webm/.mp4/.webp. */
  name: string
  /** Captured pixel size of the encoded file, for the intrinsic aspect ratio. */
  width: number
  height: number
  /** Describes what the clip shows. Not decorative: it is the only content a
   *  screen reader gets, because a silent looping video says nothing. */
  alt: string
  caption?: string
  className?: string
  priority?: boolean
}

/**
 * A short, silent, looping clip of the real product.
 *
 * Three things this does that a bare <video> does not:
 *
 * 1. It never fetches the video for someone who asked for reduced motion.
 *    Rendering the poster and setting the video to `paused` is not enough --
 *    the file still downloads. The <video> element is not mounted at all, so
 *    the request is never made. A page with six clips is several megabytes,
 *    and the person who turned motion off is the likeliest to be on a
 *    connection that minds.
 *
 * 2. It only mounts the video once the clip is near the viewport. Six autoplay
 *    videos decoding at once on first paint is the classic reason these pages
 *    feel heavy; the reference sites that do this well all defer.
 *
 * 3. It renders the poster as the server-side markup, so the first paint has
 *    the frame already -- no empty box, and no layout shift when the video
 *    arrives, because both sit in the same fixed aspect-ratio box.
 */
export default function ProductClip({
  name, width, height, alt, caption, className, priority = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [play, setPlay] = useState(false)

  useEffect(() => {
    // matchMedia rather than a CSS query: this decides whether a network
    // request happens, which CSS cannot express.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    const host = hostRef.current
    if (!host) return

    if (priority) { setPlay(true); return }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setPlay(true); io.disconnect() }
      },
      // Start loading a little before it arrives, so the first loop is already
      // running by the time it is actually on screen.
      { rootMargin: '300px 0px' },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [priority])

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        ref={hostRef}
        className="clip"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {play ? (
          <video
            width={width}
            height={height}
            poster={`/clips/${name}.webp`}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label={alt}
          >
            {/* VP9 first: roughly half the bytes of the H.264 at the same
                quality. Safari takes the mp4. */}
            <source src={`/clips/${name}.webm`} type="video/webm" />
            <source src={`/clips/${name}.mp4`} type="video/mp4" />
          </video>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/clips/${name}.webp`} width={width} height={height} alt={alt} />
        )}
      </div>
      {caption && <figcaption className="clipcap">{caption}</figcaption>}
    </figure>
  )
}
