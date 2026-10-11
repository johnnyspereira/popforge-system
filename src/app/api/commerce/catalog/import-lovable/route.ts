import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { importLovableCatalog } from "@/lib/commerce/import-lovable-catalog";
import { transaction } from "@/lib/mysql/db";

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const auth = await getAuthContext(session.user.id);
  if (!auth || !hasMinRole(auth.profile.account_role, "admin")) return Response.json({ error: "Sem permissão para importar o catálogo." }, { status: 403 });
  try {
    const result = await transaction((connection) => importLovableCatalog(connection, auth.account.id));
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("[lovable-catalog-import]", error);
    return Response.json({ error: "Não foi possível importar o catálogo. Confirme que a migration 053 foi aplicada." }, { status: 500 });
  }
}
