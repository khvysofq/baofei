import { NextResponse } from "next/server";
import {
  ADMIN_SETUP_HINT,
  adminConfigured,
  isAdminAuthenticated,
} from "@/lib/admin/auth";
import { query } from "@/lib/db";

async function guard(): Promise<NextResponse | null> {
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, ...ADMIN_SETUP_HINT }, { status: 503 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }
  return null;
}

type CountRow = {
  views_today: string;
  views_7d: string;
  views_30d: string;
  views_total: string;
  visitors_today: string;
  visitors_7d: string;
  visitors_30d: string;
  visitors_total: string;
};

type VinRow = {
  total_today: string;
  total_7d: string;
  total_30d: string;
  total_all: string;
  ok_today: string;
  ok_7d: string;
  ok_30d: string;
  unique_vin_30d: string;
};

type DailyRow = {
  date: string;
  label: string;
  views: number;
  visitors: number;
  vin_queries: number;
  vin_ok: number;
};

type RecentRow = {
  id: string;
  vin: string;
  is_demo: boolean;
  status: "ok" | "not_found" | "error";
  error_code: string | null;
  brand_model: string | null;
  vehicle_type: string | null;
  provider: string | null;
  pricing_version: number | null;
  queried_at: string;
};

function n(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;

  try {
    const countRows = await query<CountRow>(`
      WITH b AS (
        SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date AS today
      )
      SELECT
        count(*) FILTER (WHERE d = b.today)::text AS views_today,
        count(*) FILTER (WHERE d >= b.today - 6)::text AS views_7d,
        count(*) FILTER (WHERE d >= b.today - 29)::text AS views_30d,
        count(*)::text AS views_total,
        count(DISTINCT visitor_id) FILTER (WHERE d = b.today)::text AS visitors_today,
        count(DISTINCT visitor_id) FILTER (WHERE d >= b.today - 6)::text AS visitors_7d,
        count(DISTINCT visitor_id) FILTER (WHERE d >= b.today - 29)::text AS visitors_30d,
        count(DISTINCT visitor_id)::text AS visitors_total
      FROM (
        SELECT visitor_id, (created_at AT TIME ZONE 'Asia/Shanghai')::date AS d
        FROM visit_events
      ) t, b
    `);

    const vinRows = await query<VinRow>(`
      WITH b AS (
        SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date AS today
      )
      SELECT
        count(*) FILTER (WHERE d = b.today)::text AS total_today,
        count(*) FILTER (WHERE d >= b.today - 6)::text AS total_7d,
        count(*) FILTER (WHERE d >= b.today - 29)::text AS total_30d,
        count(*)::text AS total_all,
        count(*) FILTER (WHERE d = b.today AND status = 'ok')::text AS ok_today,
        count(*) FILTER (WHERE d >= b.today - 6 AND status = 'ok')::text AS ok_7d,
        count(*) FILTER (WHERE d >= b.today - 29 AND status = 'ok')::text AS ok_30d,
        count(DISTINCT vin) FILTER (WHERE d >= b.today - 29)::text AS unique_vin_30d
      FROM (
        SELECT vin, status, (created_at AT TIME ZONE 'Asia/Shanghai')::date AS d
        FROM vin_search_events
      ) t, b
    `);

    const daily = await query<DailyRow>(`
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE 'Asia/Shanghai')::date - 13,
          (now() AT TIME ZONE 'Asia/Shanghai')::date,
          interval '1 day'
        )::date AS d
      )
      SELECT
        to_char(days.d, 'YYYY-MM-DD') AS date,
        to_char(days.d, 'MM-DD') AS label,
        (SELECT count(*) FROM visit_events v
          WHERE (v.created_at AT TIME ZONE 'Asia/Shanghai')::date = days.d)::int AS views,
        (SELECT count(DISTINCT v.visitor_id) FROM visit_events v
          WHERE (v.created_at AT TIME ZONE 'Asia/Shanghai')::date = days.d)::int AS visitors,
        (SELECT count(*) FROM vin_search_events q
          WHERE (q.created_at AT TIME ZONE 'Asia/Shanghai')::date = days.d)::int AS vin_queries,
        (SELECT count(*) FROM vin_search_events q
          WHERE (q.created_at AT TIME ZONE 'Asia/Shanghai')::date = days.d
            AND q.status = 'ok')::int AS vin_ok
      FROM days
      ORDER BY days.d
    `);

    const recent = await query<RecentRow>(`
      SELECT
        id::text AS id,
        vin,
        is_demo,
        status,
        error_code,
        brand_model,
        vehicle_type,
        provider,
        pricing_version,
        to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI') AS queried_at
      FROM vin_search_events
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const counts = countRows[0];
    const vins = vinRows[0];

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      visits: {
        views: {
          today: n(counts?.views_today),
          last7: n(counts?.views_7d),
          last30: n(counts?.views_30d),
          total: n(counts?.views_total),
        },
        visitors: {
          today: n(counts?.visitors_today),
          last7: n(counts?.visitors_7d),
          last30: n(counts?.visitors_30d),
          total: n(counts?.visitors_total),
        },
      },
      vin: {
        total: {
          today: n(vins?.total_today),
          last7: n(vins?.total_7d),
          last30: n(vins?.total_30d),
          total: n(vins?.total_all),
        },
        ok: {
          today: n(vins?.ok_today),
          last7: n(vins?.ok_7d),
          last30: n(vins?.ok_30d),
        },
        uniqueVin30d: n(vins?.unique_vin_30d),
      },
      daily: daily.map((row) => ({
        date: row.date,
        label: row.label,
        views: row.views,
        visitors: row.visitors,
        vinQueries: row.vin_queries,
        vinOk: row.vin_ok,
      })),
      recent: recent.map((row) => ({
        id: row.id,
        vin: row.vin,
        isDemo: row.is_demo,
        status: row.status,
        errorCode: row.error_code,
        brandModel: row.brand_model,
        vehicleType: row.vehicle_type,
        provider: row.provider,
        pricingVersion: row.pricing_version,
        queriedAt: row.queried_at,
      })),
    });
  } catch (caught) {
    console.error("[analytics] stats query failed", caught);
    return NextResponse.json(
      { ok: false, error: "统计数据读取失败，请检查数据库后重试。" },
      { status: 500 },
    );
  }
}