import React from 'react';
import { progress } from './anim';
import { useSceneCtx } from './context';
import { fontFamily } from './fonts';
import type { Skill } from './skills';
import type { LayoutId } from './types';
import { Enter, Heading, Kicker, Rule, Sub, Words, fitHeading, headingType } from './ui';

/* ------------------------------------------------------------------ *\
   Layouts are pure: they read the scene + skill from context and own
   all of their own motion. Adding a style to `skills.ts` restyles every
   one of them, and adding a layout here is instantly available to the
   AI planner and the scene picker.
\* ------------------------------------------------------------------ */

const isPortrait = (width: number, height: number) => height > width;

/** Turns "98%" / "$1,240" / "3.5x" into a count-up while keeping affixes. */
const countUp = (value: string, p: number) => {
  const match = value.match(/^([^\d-]*)(-?[\d.,]+)(.*)$/);
  if (!match) return value;
  const [, prefix = '', raw = '', suffix = ''] = match;
  const numeric = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return value;
  const decimals = raw.includes('.') ? (raw.split('.')[1] ?? '').length : 0;
  const current = numeric * p;
  const body = raw.includes(',')
    ? current.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : current.toFixed(decimals);
  return `${prefix}${body}${suffix}`;
};

const HeroLayout: React.FC = () => {
  const { scene, skill, unit, width, height } = useSceneCtx();
  const size = fitHeading(scene.headline, unit * 104, skill.type.headingScale);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 26 }}>
      {scene.kicker ? (
        <Enter delay={0}>
          <Kicker>{scene.kicker}</Kicker>
        </Enter>
      ) : null}
      <Enter delay={4} duration={22}>
        <Heading size={size} maxWidth={width * 0.92}>
          {scene.headline}
        </Heading>
      </Enter>
      {scene.sub ? (
        <Enter delay={12}>
          <Sub maxWidth={width * (isPortrait(width, height) ? 0.9 : 0.62)}>{scene.sub}</Sub>
        </Enter>
      ) : null}
      <Enter delay={18} style={{ marginTop: unit * 8 }}>
        <Rule width={unit * 150} />
      </Enter>
    </div>
  );
};

const StatementLayout: React.FC = () => {
  const { scene, skill, unit, width, height } = useSceneCtx();
  const size = fitHeading(scene.headline, unit * 138, skill.type.headingScale);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: unit * 30 }}>
      {scene.kicker ? (
        <Enter delay={0}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Kicker>{scene.kicker}</Kicker>
          </div>
        </Enter>
      ) : null}
      <Words text={scene.headline} delay={2} step={2.2} style={headingType(skill, size, 'center')} />
      {scene.sub ? (
        <Enter delay={16}>
          <Sub align="center" maxWidth={width * (isPortrait(width, height) ? 0.86 : 0.66)}>
            {scene.sub}
          </Sub>
        </Enter>
      ) : null}
    </div>
  );
};

const BulletsLayout: React.FC = () => {
  const { scene, skill, unit, width } = useSceneCtx();
  const items = (scene.items ?? []).slice(0, 6);
  const line = `${unit * 1.5}px solid ${skill.palette.line}`;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 30 }}>
      {scene.kicker ? (
        <Enter delay={0}>
          <Kicker>{scene.kicker}</Kicker>
        </Enter>
      ) : null}
      <Enter delay={3}>
        <Heading size={fitHeading(scene.headline, unit * 74, skill.type.headingScale)} maxWidth={width * 0.9}>
          {scene.headline}
        </Heading>
      </Enter>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: unit * 6 }}>
        {items.map((item, index) => (
          <Enter key={`${index}-${item}`} delay={10 + index * Math.max(3, skill.motion.stagger)} duration={16}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: unit * 24,
                padding: `${unit * 21}px 0`,
                borderTop: line,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamily(skill.fonts.body),
                  fontSize: unit * 21,
                  color: skill.palette.accent,
                  minWidth: unit * 48,
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: fontFamily(skill.fonts.body), fontSize: unit * 33, color: skill.palette.fg, lineHeight: 1.3 }}>
                {item}
              </span>
            </div>
          </Enter>
        ))}
        <div style={{ borderTop: line }} />
      </div>
    </div>
  );
};

const StatLayout: React.FC = () => {
  const { scene, skill, unit, width, height, frame, accent } = useSceneCtx();
  const q = progress(frame, 8, 36, 'smooth');
  const display = countUp(scene.value ?? '', q);
  const bars = [0.42, 0.68, 0.52, 0.88, 0.74, 1];
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: unit * 50 }}>
      <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: unit * 20 }}>
        <Enter delay={0}>
          <Kicker>{scene.kicker ?? 'Key metric'}</Kicker>
        </Enter>
        <div
          style={{
            fontFamily: fontFamily(skill.fonts.heading),
            fontSize: fitHeading(display || scene.headline, unit * 210, 1),
            fontWeight: 800,
            lineHeight: 0.88,
            letterSpacing: '-0.045em',
            color: accent,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {display}
        </div>
        <Enter delay={12}>
          <Heading size={unit * 48}>{scene.headline}</Heading>
        </Enter>
        {scene.sub ? (
          <Enter delay={18}>
            <Sub maxWidth={width * 0.66}>{scene.sub}</Sub>
          </Enter>
        ) : null}
      </div>
      <div
        style={{
          flex: 0.6,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: unit * 14,
          height: unit * 340,
          maxWidth: isPortrait(width, height) ? unit * 240 : undefined,
        }}
      >
        {bars.map((bar, index) => {
          const grow = progress(frame, 14 + index * 4, 26, skill.motion.ease);
          return (
            <div
              key={index}
              style={{
                flex: 1,
                height: `${bar * 100 * grow}%`,
                background: index % 2 === 0 ? accent : skill.palette.accent2,
                borderRadius: unit * Math.max(2, skill.shape.radius / 3),
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const QuoteLayout: React.FC = () => {
  const { scene, skill, unit, width, height } = useSceneCtx();
  const size = fitHeading(scene.headline, unit * 86, skill.type.headingScale);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 24 }}>
      <Enter duration={20}>
        <div
          style={{
            fontFamily: fontFamily(skill.fonts.heading),
            fontSize: unit * 190,
            lineHeight: 0.62,
            height: unit * 74,
            color: skill.palette.accent,
            marginBottom: -unit * 8,
          }}
        >
          &ldquo;
        </div>
      </Enter>
      <Words text={scene.headline} delay={6} step={2} style={headingType(skill, size, 'left', skill.fonts.heading === 'playfair')} />
      {scene.sub || scene.kicker ? (
        <Enter delay={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: unit * 18, marginTop: unit * 10 }}>
            <div style={{ width: unit * 44, height: unit * 2, background: skill.palette.accent }} />
            <span style={{ fontFamily: fontFamily(skill.fonts.body), fontSize: unit * 26, color: skill.palette.muted, letterSpacing: '0.04em' }}>
              {scene.sub ?? scene.kicker}
            </span>
          </div>
        </Enter>
      ) : null}
      <div style={{ maxWidth: width * (isPortrait(width, height) ? 0.9 : 0.74) }} />
    </div>
  );
};

/** Abstract right-hand visual for the split layout — pure SVG, no assets. */
const Orb: React.FC<{ skill: Skill; unit: number }> = ({ skill, unit }) => {
  const { frame } = useSceneCtx();
  const { accent, accent2 } = skill.palette;
  const size = unit * 420;
  const pulse = 1 + Math.sin(frame / 26) * 0.03;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="orb-core" cx="36%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="38%" stopColor={accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={accent2} stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id="orb-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={accent2} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke={skill.palette.line} strokeWidth="0.6" />
      <circle
        cx="100"
        cy="100"
        r="72"
        fill="none"
        stroke="url(#orb-ring)"
        strokeWidth="1.4"
        strokeDasharray="6 8"
        transform={`rotate(${frame * 0.5} 100 100)`}
      />
      <circle cx="100" cy="100" r="52" fill="url(#orb-core)" transform={`scale(${pulse})`} style={{ transformOrigin: '100px 100px' }} />
      <circle cx="100" cy="100" r="52" fill="none" stroke={accent2} strokeOpacity="0.35" strokeWidth="0.6" />
      {[0, 1, 2].map((index) => {
        const angle = (frame * 0.9 + index * 120) * (Math.PI / 180);
        const radius = 82;
        return (
          <circle
            key={index}
            cx={100 + Math.cos(angle) * radius}
            cy={100 + Math.sin(angle) * radius}
            r={index === 0 ? 4 : 2.6}
            fill={index === 0 ? accent : accent2}
          />
        );
      })}
      <line x1="100" y1="4" x2="100" y2="196" stroke={skill.palette.line} strokeWidth="0.4" strokeDasharray="2 6" />
    </svg>
  );
};

const SplitLayout: React.FC = () => {
  const { scene, skill, unit, width, height } = useSceneCtx();
  const portrait = isPortrait(width, height);
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: portrait ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: unit * (portrait ? 30 : 56),
      }}
    >
      <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', gap: unit * 22, width: '100%' }}>
        {scene.kicker ? (
          <Enter delay={0}>
            <Kicker>{scene.kicker}</Kicker>
          </Enter>
        ) : null}
        <Enter delay={4}>
          <Heading size={fitHeading(scene.headline, unit * 80, skill.type.headingScale)}>{scene.headline}</Heading>
        </Enter>
        {scene.sub ? (
          <Enter delay={11}>
            <Sub maxWidth={width * 0.9}>{scene.sub}</Sub>
          </Enter>
        ) : null}
        {scene.items?.length ? (
          <div style={{ display: 'flex', gap: unit * 12, flexWrap: 'wrap', marginTop: unit * 6 }}>
            {scene.items.slice(0, 4).map((item, index) => (
              <Enter key={item} delay={14 + index * 4}>
                <span
                  style={{
                    padding: `${unit * 12}px ${unit * 22}px`,
                    border: `${unit * 1.6}px solid ${skill.palette.line}`,
                    borderRadius: unit * 999,
                    fontFamily: fontFamily(skill.fonts.body),
                    fontSize: unit * 22,
                    color: skill.palette.fg,
                    background: skill.palette.surface,
                  }}
                >
                  {item}
                </span>
              </Enter>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Enter delay={2} duration={26}>
          <Orb skill={skill} unit={unit} />
        </Enter>
      </div>
    </div>
  );
};

const OutroLayout: React.FC = () => {
  const { scene, skill, unit, width, height, frame, accent } = useSceneCtx();
  const cta = scene.items?.[0];
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: unit * 28,
      }}
    >
      <Enter duration={24}>
        <div
          style={{
            width: unit * 66,
            height: unit * 66,
            background: accent,
            borderRadius: unit * Math.max(4, skill.shape.radius),
            transform: `rotate(${45 + Math.sin(frame / 34) * 9}deg)`,
            boxShadow: skill.glow > 0.2 ? `0 0 ${unit * 60}px ${accent}66` : undefined,
          }}
        />
      </Enter>
      <Enter delay={6}>
        <Heading align="center" size={fitHeading(scene.headline, unit * 108, skill.type.headingScale)} maxWidth={width * 0.86}>
          {scene.headline}
        </Heading>
      </Enter>
      {scene.sub ? (
        <Enter delay={13}>
          <Sub align="center" maxWidth={width * (isPortrait(width, height) ? 0.86 : 0.6)}>
            {scene.sub}
          </Sub>
        </Enter>
      ) : null}
      {cta ? (
        <Enter delay={19}>
          <div
            style={{
              padding: `${unit * 18}px ${unit * 40}px`,
              border: `${unit * 2.4}px solid ${accent}`,
              borderRadius: unit * 999,
              fontFamily: fontFamily(skill.fonts.body),
              fontSize: unit * 25,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {cta}
          </div>
        </Enter>
      ) : null}
    </div>
  );
};

export const LAYOUT_COMPONENTS: Record<LayoutId, React.FC> = {
  hero: HeroLayout,
  statement: StatementLayout,
  bullets: BulletsLayout,
  stat: StatLayout,
  quote: QuoteLayout,
  split: SplitLayout,
  outro: OutroLayout,
};
