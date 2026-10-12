import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { selectRows, transaction } from "@/lib/mysql/db";

const clean = (value: unknown, max = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
async function context() {
  const session = await getSession();
  return session ? getAuthContext(session.user.id) : null;
}

export async function GET() {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const id = auth.account.id;
  const [summary, entries, orders] = await Promise.all([
    selectRows<RowDataPacket[]>(
      `SELECT
      (SELECT COALESCE(SUM(total),0) FROM commerce_orders WHERE account_id=? AND payment_status='paid') AS online_revenue,
      (SELECT COALESCE(SUM(paid_amount),0) FROM finance_sales WHERE account_id=? AND status<>'void') AS pos_revenue,
      (SELECT COALESCE(SUM(quantity*unit_cost),0) FROM commerce_production_material_usage WHERE account_id=? AND usage_type IN ('actual','waste')) AS production_material_cost,
      (SELECT COALESCE(SUM(COALESCE(actual_labor_cost,0)+COALESCE(actual_energy_cost,0)+COALESCE(actual_other_cost,0)),0) FROM commerce_production_jobs WHERE account_id=?) AS production_other_cost,
      (SELECT COALESCE(SUM(amount),0) FROM commerce_financial_entries WHERE account_id=? AND entry_type IN ('initial_investment','capital_injection')) AS invested,
      (SELECT COALESCE(SUM(amount),0) FROM commerce_financial_entries WHERE account_id=? AND entry_type='operating_expense') AS operating_expenses,
      (SELECT COALESCE(SUM(amount),0) FROM commerce_financial_entries WHERE account_id=? AND entry_type='owner_draw') AS owner_draws`,
      [id, id, id, id, id, id, id],
    ),
    selectRows<RowDataPacket[]>(
      "SELECT e.*,o.order_number,j.title AS job_title FROM commerce_financial_entries e LEFT JOIN commerce_orders o ON o.id=e.commerce_order_id LEFT JOIN commerce_production_jobs j ON j.id=e.production_job_id WHERE e.account_id=? ORDER BY e.occurred_on DESC,e.created_at DESC LIMIT 200",
      [id],
    ),
    selectRows<RowDataPacket[]>(
      "SELECT id,order_number,customer_name,total FROM commerce_orders WHERE account_id=? ORDER BY created_at DESC LIMIT 100",
      [id],
    ),
  ]);
  return Response.json({ summary: summary[0] || {}, entries, orders });
}

export async function POST(request: Request) {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent"))
    return Response.json(
      { error: "Sem permissão para lançar movimentos." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const entryType = clean(body?.entryType, 40);
  const category = clean(body?.category, 100),
    description = clean(body?.description, 500),
    amount = Number(body?.amount);
  const date = clean(body?.occurredOn, 10);
  if (
    ![
      "initial_investment",
      "capital_injection",
      "operating_expense",
      "owner_draw",
    ].includes(entryType) ||
    !category ||
    !description ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return Response.json(
      { error: "Preencha tipo, categoria, descrição, valor e data." },
      { status: 400 },
    );
  await transaction(async (connection) =>
    connection.execute(
      "INSERT INTO commerce_financial_entries(id,account_id,entry_type,category,description,amount,occurred_on,payment_method,reference,commerce_order_id,notes,created_by_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        auth.account.id,
        entryType,
        category,
        description,
        amount,
        date,
        clean(body?.paymentMethod, 64) || null,
        clean(body?.reference, 160) || null,
        clean(body?.orderId, 36) || null,
        clean(body?.notes, 4000) || null,
        auth.user.id,
      ],
    ),
  );
  return Response.json({ success: true }, { status: 201 });
}
