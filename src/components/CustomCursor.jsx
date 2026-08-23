import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// Floaty, organic lag for the glow orb — heavier mass = more drift
const ORB_SPRING = { stiffness: 130, damping: 17, mass: 0.8 };

// Interactive element selector
const INTERACTIVE =
  'a,button,[role="button"],[tabindex]:not([tabindex="-1"]),' +
  'input,select,textarea,label,[data-cursor]';

// Text-entry selector — cross hides here so system cursor can show
const TEXT_INPUT =
  'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]),' +
  'textarea,select';

// Filter strings (CSS-transitioned via inline style)
const VIOLET_GLOW =
  'drop-shadow(0 0 3px #7c3aed) drop-shadow(0 0 8px rgba(124,58,237,0.45))';
const EMERALD_GLOW =
  'drop-shadow(0 0 4px #059669) drop-shadow(0 0 10px rgba(5,150,105,0.50))';

export default function CustomCursor() {
  const isTouch   = useRef(false);
  const [ready,    setReady]    = useState(false);
  const [hovered,  setHovered]  = useState(false); // over interactive element
  const [overText, setOverText] = useState(false); // over text input
  const [pressed,  setPressed]  = useState(false);

  // Exact cursor coords
  const mx = useMotionValue(-300);
  const my = useMotionValue(-300);

  // Lagged orb coords
  const ox = useSpring(mx, ORB_SPRING);
  const oy = useSpring(my, ORB_SPRING);

  useEffect(() => {
    if (
      'ontouchstart' in window ||
      window.matchMedia('(hover: none), (pointer: coarse)').matches
    ) {
      isTouch.current = true;
      return;
    }

    // Inject cursor: none — preserve text cursor on inputs
    const style = document.createElement('style');
    style.id = '__jc_cursor_v2';
    style.textContent =
      'html,html *{cursor:none!important}' +
      'input,textarea,select{cursor:text!important}';
    document.head.appendChild(style);

    const onMove = (e) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setReady(true);
    };

    const onOver = (e) => {
      setHovered(!!e.target.closest(INTERACTIVE));
      setOverText(!!e.target.closest(TEXT_INPUT));
    };

    const onDown = () => setPressed(true);
    const onUp   = () => setPressed(false);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup',   onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup',   onUp);
      document.getElementById('__jc_cursor_v2')?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isTouch.current) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[99999]"
      aria-hidden="true"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. SOFT GLOW ORB  (spring-lagged · breathes when idle)
          Completely different from the old "outline ring" —
          this is a filled radial-gradient blob that drifts behind.
      ───────────────────────────────────────────────────────────── */}
      <motion.div
        className="absolute top-0 left-0 rounded-full"
        style={{ x: ox, y: oy, translateX: '-50%', translateY: '-50%' }}
        animate={{
          // Gentle breathing loop at idle; snaps larger on hover
          width:  hovered ? 58 : [44, 50, 44],
          height: hovered ? 58 : [44, 50, 44],
        }}
        transition={
          hovered
            ? { duration: 0.28, ease: 'easeOut' }
            : { duration: 2.9, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Violet layer — normal state */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ opacity: hovered ? 0 : 1 }}
          transition={{ duration: 0.38 }}
          style={{
            background:
              'radial-gradient(circle, rgba(167,139,250,0.42) 0%, rgba(99,102,241,0.10) 52%, transparent 76%)',
          }}
        />
        {/* Emerald layer — hover state (crossfades in) */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.38 }}
          style={{
            background:
              'radial-gradient(circle, rgba(52,211,153,0.46) 0%, rgba(16,185,129,0.10) 52%, transparent 76%)',
          }}
        />
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          2. HEARTBEAT PULSE RINGS  (hover-only sonar / ECG effect)
          Two staggered circles expand outward and fade — evokes
          a heart-monitor or medical scanning animation.
      ───────────────────────────────────────────────────────────── */}
      {hovered && (
        <>
          <motion.div
            className="absolute top-0 left-0 rounded-full"
            style={{
              x: ox,
              y: oy,
              translateX: '-50%',
              translateY: '-50%',
              border: '1.5px solid rgba(52,211,153,0.65)',
            }}
            animate={{ width: [8, 74], height: [8, 74], opacity: [0.85, 0] }}
            transition={{ duration: 1.45, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute top-0 left-0 rounded-full"
            style={{
              x: ox,
              y: oy,
              translateX: '-50%',
              translateY: '-50%',
              border: '1px solid rgba(52,211,153,0.35)',
            }}
            animate={{ width: [8, 74], height: [8, 74], opacity: [0.55, 0] }}
            transition={{
              duration: 1.45,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 0.62,
            }}
          />
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. ROUNDED MEDICAL CROSS  (exact cursor position)
          Two overlapping rounded rectangles form a soft ✚ shape.
          Hidden over text inputs so the system text-cursor shows.
          Color: violet-300 → emerald-300 on hover.
          Glow: CSS-transitioned drop-shadow (violet → emerald).
      ───────────────────────────────────────────────────────────── */}
      {!overText && (
        <motion.div
          className="absolute top-0 left-0"
          style={{ x: mx, y: my, translateX: '-50%', translateY: '-50%' }}
          animate={{
            scale:   pressed ? 0.70 : hovered ? 1.20 : 1,
            opacity: ready   ? 1    : 0,
          }}
          transition={{ duration: 0.13, ease: 'easeOut' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{
              /* Using CSS color + currentColor lets the browser interpolate fill */
              color:      hovered ? '#6ee7b7' : '#c4b5fd',
              filter:     hovered ? EMERALD_GLOW : VIOLET_GLOW,
              transition: 'color 0.32s ease, filter 0.32s ease',
            }}
          >
            {/* Vertical arm */}
            <rect x="7" y="1.5" width="4" height="15" rx="2" fill="currentColor" />
            {/* Horizontal arm */}
            <rect x="1.5" y="7" width="15" height="4" rx="2" fill="currentColor" />
          </svg>
        </motion.div>
      )}
    </div>
  );
}
