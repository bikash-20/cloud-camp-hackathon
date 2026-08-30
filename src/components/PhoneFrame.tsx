import { motion } from 'framer-motion';
import { T } from '../data';

interface PhoneFrameProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

/**
 * Phone bezel for the demo.
 *
 * Layer stack (bottom → top):
 *   0. Sage vertical gradient — fills the bezel
 *   1. Status bar (9:41 + signal + 5G + battery) — transparent
 *   2. App header strip ("NutriVision" + pagination dots) — transparent
 *   3. Screen content (sits over the gradient)
 *   4. Outer bezel border + multi-layer drop shadow + 3D tilt
 */
export default function PhoneFrame({ children, headerRight }: PhoneFrameProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, rotateX: 8, rotateY: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, rotateX: 1.5, rotateY: -1.5, scale: 1 }}
        transition={{
          opacity: { duration: 0.5 },
          y: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
          rotateX: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
          rotateY: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
          scale: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        }}
        style={{
          width: 360,
          borderRadius: 44,
          background: 'transparent',
          boxShadow: 'var(--shadow-phone)',
          position: 'relative',
          transformStyle: 'preserve-3d',
          perspective: 1200,
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: 38,
            overflow: 'hidden',
            minHeight: 760,
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
          }}
        >
          {/* Layer 0: sage vertical gradient */}
          <div className="sage-bg" />

          {/* Layer 1: status bar */}
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              padding: '14px 22px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'transparent',
            }}
            aria-hidden="true"
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: T.earth6,
                flex: '0 0 auto',
              }}
            >
              9:41
            </span>
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                color: T.earth6,
                flex: '0 0 auto',
              }}
            >
              <span style={{ letterSpacing: 1 }}>●●●</span>
              <span>5G</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 11,
                    borderRadius: 3,
                    border: `1px solid ${T.earth6}`,
                    padding: 1,
                    display: 'inline-flex',
                  }}
                >
                  <span
                    style={{
                      width: '85%',
                      height: '100%',
                      background: T.earth6,
                      borderRadius: 1,
                    }}
                  />
                </span>
                <span
                  style={{
                    width: 2,
                    height: 4,
                    background: T.earth6,
                    borderRadius: 1,
                  }}
                />
              </span>
            </div>
          </div>

          {/* Layer 2: app header */}
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              padding: '12px 22px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'transparent',
            }}
          >
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 20,
                color: T.earth6,
                letterSpacing: 0,
              }}
            >
              NutriVision
            </div>
            {headerRight}
          </div>

          {/* Layer 3: screen content */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              minHeight: 540,
              paddingTop: 8,
              flex: 1,
            }}
          >
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}