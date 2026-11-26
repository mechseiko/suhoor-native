import React, { useEffect, useRef, useState } from 'react'
import GamificationCelebration from './GamificationCelebration'
import { subscribeCelebration } from '../utils/celebrationBus'

/**
 * Renders level-up and badge celebrations for the whole app.
 *
 * Mounted once, at the root, next to <AlarmOverlay />. It is deliberately not
 * tied to any screen: a check-in happens on Groups, a buzz happens on Group
 * Detail, and the next session may open somewhere else entirely — the
 * celebration must not depend on which screen was on top.
 *
 * One at a time, in order. If two things land together (a level and a badge),
 * each gets its own confetti rather than overlapping. A short gap between them
 * keeps the second from being swallowed by the first's animation.
 */
export const GamificationCelebrationHost = () => {
  const [queue, setQueue] = useState([])
  const [current, setCurrent] = useState(null)
  const gapTimer = useRef(null)

  useEffect(() => {
    const unsubscribe = subscribeCelebration((payload) => {
      setQueue((previous) => [...previous, payload])
    })
    return () => {
      unsubscribe()
      if (gapTimer.current) clearTimeout(gapTimer.current)
    }
  }, [])

  // Pull the next item when idle. The gap after a dismissal is what stops two
  // celebrations from being drawn on top of each other.
  useEffect(() => {
    if (current || queue.length === 0 || gapTimer.current) return
    const [next, ...rest] = queue
    setQueue(rest)
    setCurrent(next)
  }, [queue, current])

  const handleDismiss = () => {
    setCurrent(null)
    gapTimer.current = setTimeout(() => {
      gapTimer.current = null
      // Nudge the pull effect by touching state it already depends on.
      setQueue((previous) => [...previous])
    }, 350)
  }

  if (!current) return null

  return <GamificationCelebration celebration={current} onDismiss={handleDismiss} />
}

export default GamificationCelebrationHost
