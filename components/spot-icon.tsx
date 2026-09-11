'use client';
import {
  BookOpen,
  Camera,
  Coffee,
  Flag,
  FlaskConical,
  Gamepad2,
  Music,
  Palette,
  Sparkles,
  Theater,
  Trophy,
  Utensils,
} from 'lucide-react';
import { defaultSpotIconKeys, isCustomSpotIcon } from '@/lib/types';
/**
 * The icons an organiser can pick for a location. The first six are also the
 * defaults, in order, so a location saved before icons existed keeps the look
 * it already had.
 */
export const spotIconTemplates = [
  { key: 'flag', label: '受付・入口', Icon: Flag },
  { key: 'palette', label: '美術・展示', Icon: Palette },
  { key: 'flask', label: '理科・実験', Icon: FlaskConical },
  { key: 'coffee', label: 'カフェ・休憩', Icon: Coffee },
  { key: 'music', label: '音楽', Icon: Music },
  { key: 'theater', label: 'ステージ・演劇', Icon: Theater },
  { key: 'book', label: '図書・文芸', Icon: BookOpen },
  { key: 'camera', label: '写真・記録', Icon: Camera },
  { key: 'game', label: 'ゲーム・遊び', Icon: Gamepad2 },
  { key: 'food', label: '模擬店・食品', Icon: Utensils },
  { key: 'trophy', label: '表彰・ゴール', Icon: Trophy },
  { key: 'sparkles', label: 'その他', Icon: Sparkles },
] as const;
const template = (key: string) =>
  spotIconTemplates.find((choice) => choice.key === key);
/**
 * One location's icon: an uploaded image, a chosen template, or — when neither
 * is set — the template that matches its position in the list.
 */
export function SpotIcon({
  icon,
  index = 0,
  size = 34,
}: {
  icon?: string | null;
  index?: number;
  size?: number;
}) {
  const value = icon ?? '';
  if (isCustomSpotIcon(value))
    return (
      <>
        {/* The picture is a data URL kept in the database, not a file on a
            server, so there is nothing for next/image to optimise. */}
        {/* eslint-disable-next-line next/no-img-element */}
        <img
          className="spot-icon-image"
          src={value}
          alt=""
          width={size}
          height={size}
        />
      </>
    );
  const choice =
    template(value) ??
    template(defaultSpotIconKeys[index % defaultSpotIconKeys.length]) ??
    spotIconTemplates[0];
  return <choice.Icon size={size} strokeWidth={1.4} aria-hidden="true" />;
}
