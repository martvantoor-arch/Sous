// Machineleesbare weergave van alle toezeggingen met hun status.
//
// Bestaat om de reconciliatieset te kunnen draaien vanaf een plek die niet bij
// de database kan. Zelfde slot als `/api/bronnen/[id]`: dicht tenzij API_TOKEN
// gezet is, en dan alleen met dat token.
//
// Bewust alleen lezen. Statussen wijzigen doe je niet via een endpoint; die
// volgen uit de bronnen en uit de stilteregel.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getDb,
  commitments,
  people,
  projects,
  sources,
  changeLog,
  eq,
  desc,
} from '@meetinghub/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = process.env.API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'API_TOKEN niet geconfigureerd' }, { status: 404 });
  }
  if (!authorised(request.headers.get('authorization'), token)) {
    return NextResponse.json({ error: 'niet geautoriseerd' }, { status: 401 });
  }

  const db = getDb();

  const rijen = await db
    .select({
      id: commitments.id,
      wat: commitments.what,
      status: commitments.status,
      statusBron: commitments.statusSource,
      statusZekerheid: commitments.statusConf,
      eigenaar: people.name,
      ownerRaw: commitments.ownerRaw,
      project: projects.name,
      deadline: commitments.deadline,
      deadlineRaw: commitments.deadlineRaw,
      eersteBron: commitments.firstSeenSource,
      laatsteBron: commitments.lastSeenSource,
      laatstGezien: commitments.lastSeenAt,
      afgeslotenOp: commitments.closedAt,
      afgeslotenCitaat: commitments.closedQuote,
      bronTitel: sources.title,
    })
    .from(commitments)
    .leftJoin(people, eq(commitments.ownerId, people.id))
    .leftJoin(projects, eq(commitments.projectId, projects.id))
    .leftJoin(sources, eq(commitments.lastSeenSource, sources.id))
    .orderBy(desc(commitments.lastSeenAt));

  // De logregels erbij: zonder de geschiedenis kun je niet zien of een
  // toezegging in één keer op afgerond kwam of eerst is bijgewerkt.
  const log = await db
    .select({
      entityId: changeLog.entityId,
      veld: changeLog.field,
      oud: changeLog.oldValue,
      nieuw: changeLog.newValue,
      herkomst: changeLog.origin,
      citaat: changeLog.quote,
      op: changeLog.createdAt,
    })
    .from(changeLog)
    .where(eq(changeLog.entityType, 'toezegging'))
    .orderBy(desc(changeLog.createdAt));

  const perToezegging = new Map<string, typeof log>();
  for (const r of log) {
    perToezegging.set(r.entityId, [...(perToezegging.get(r.entityId) ?? []), r]);
  }

  return NextResponse.json({
    aantal: rijen.length,
    perStatus: rijen.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
    toezeggingen: rijen.map((r) => ({
      ...r,
      geschiedenis: (perToezegging.get(r.id) ?? []).map((g) => ({
        veld: g.veld,
        van: g.oud,
        naar: g.nieuw,
        herkomst: g.herkomst,
        citaat: g.citaat,
        op: g.op,
      })),
    })),
  });
}

function authorised(header: string | null, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
