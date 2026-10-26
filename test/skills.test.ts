import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKILLS, getSkill } from '../src/remotion/skills';
import { SKILL_IDS, type SkillId } from '../src/remotion/types';

const PALETTE_KEYS = ['bg', 'bg2', 'surface', 'fg', 'muted', 'accent', 'accent2', 'line'] as const;
const FONT_KEYS = ['inter', 'grotesk', 'bebas', 'playfair', 'mono'];
const ENTER_KEYS = ['fadeUp', 'clipUp', 'slideRight', 'pop', 'blurIn', 'scaleIn'];

test('every skill id is declared and unique', () => {
  assert.equal(SKILLS.length, SKILL_IDS.length);
  assert.deepEqual(
    [...SKILLS].map((skill) => skill.id).sort(),
    [...SKILL_IDS].sort(),
  );
  assert.equal(new Set(SKILLS.map((skill) => skill.name)).size, SKILLS.length);
});

test('skills are fully populated so no scene renders without a token', () => {
  for (const skill of SKILLS) {
    for (const key of PALETTE_KEYS) {
      assert.ok((skill.palette as Record<string, string>)[key], `${skill.id}.${key} missing`);
    }
    assert.equal(skill.swatches.length, 4);
    assert.ok(skill.fonts.heading && skill.fonts.body);
    assert.ok(FONT_KEYS.includes(skill.fonts.heading), `${skill.id} heading font`);
    assert.ok(FONT_KEYS.includes(skill.fonts.body), `${skill.id} body font`);
    assert.ok(ENTER_KEYS.includes(skill.motion.enter), `${skill.id} entrance`);
    assert.ok(['smooth', 'snappy', 'bouncy', 'linear'].includes(skill.motion.ease), `${skill.id} easing`);
    assert.ok(skill.motion.stagger >= 0 && skill.motion.exit > 0, `${skill.id} motion timings`);
    assert.ok(skill.type.headingScale > 0 && skill.type.headingWeight >= 400 && skill.type.headingWeight <= 900);
    assert.ok(skill.grain >= 0 && skill.grain <= 1 && skill.glow >= 0 && skill.glow <= 1);
    assert.ok(skill.blurb.length > 10 && skill.voice.length > 20, `${skill.id} needs art direction`);
    for (const swatch of skill.swatches) assert.match(swatch, /^#[0-9a-f]{3,8}$/i, `${skill.id} swatch ${swatch}`);
  }
});

test('skill palettes give readable text contrast', () => {
  const luminance = (hex: string) => {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
    const [r, g, b] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  for (const skill of SKILLS) {
    const fg = luminance(skill.palette.fg);
    const bg = luminance(skill.palette.bg);
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    assert.ok(ratio >= 4, `${skill.id} headline contrast ${ratio.toFixed(2)} is too low`);
  }
});

test('getSkill resolves known ids and falls back for unknown ones', () => {
  const first = SKILLS[0]!;
  for (const id of SKILL_IDS) assert.equal(getSkill(id).id, id);
  assert.equal(getSkill('does-not-exist' as SkillId).id, first.id);
});
