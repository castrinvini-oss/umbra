import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { buildGateway } from "@/server/payments";
import { getActiveSubscription } from "@/server/services/access.service";
import { advanceLead } from "@/server/services/lead.service";
import { toPlanDTO } from "@/server/services/plan.service";
import { getPaymentConfig, isDemoMode } from "@/server/services/settings.service";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = plano ? await db.plan.findFirst({ where: { slug: plano, active: true } }) : null;
  if (!plan) redirect("/planos");

  const [user, config] = await Promise.all([getCurrentUser(), getPaymentConfig()]);
  let methods = config.enabledMethods;
  let gatewayError: string | null = null;
  let requireCpf = config.requireCpf;
  try {
    const gateway = buildGateway(config);
    methods = methods.filter((m) => gateway.methods.includes(m));
    requireCpf = requireCpf || !!gateway.requiresCpf;
    if (!methods.length) gatewayError = "nenhum método de pagamento habilitado para este gateway";
  } catch (e) {
    gatewayError = (e as Error).message;
  }

  const sub = user ? await getActiveSubscription(user.id) : null;
  if (user) {
    const lead = await db.lead.findUnique({ where: { userId: user.id }, select: { stage: true } });
    if (lead?.stage === "NEW" || lead?.stage === "CANCELLED") {
      await advanceLead({ userId: user.id }, "INTERESTED", `Visitou o checkout do plano ${plan.name}`, { planId: plan.id, potentialValueCents: plan.priceCents });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <CheckoutForm
        plan={toPlanDTO(plan)}
        user={user ? { name: user.name, email: user.email } : null}
        methods={methods}
        requireCpf={requireCpf}
        gatewayError={gatewayError}
        demo={isDemoMode() && config.gateway === "mock"}
        currentPlanName={sub ? sub.plan.name : null}
        samePlan={sub?.planId === plan.id && !sub.cancelAtPeriodEnd}
      />
    </div>
  );
}
