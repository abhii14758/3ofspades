import { NextResponse } from 'next/server';
import { CARD_BACKS } from '@/config/cardBacks';
import { TABLE_THEMES } from '@/config/tableThemes';
import { ALL_EMOTES } from '@/config/emotes';

export async function GET() {
  return NextResponse.json({
    cardBacks: CARD_BACKS,
    tableThemes: TABLE_THEMES,
    emotes: ALL_EMOTES,
  });
}
