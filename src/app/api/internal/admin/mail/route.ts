import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handler, requirePermission } from "@/server/auth/rbac";
import { sendEmail, verifyMailTransport } from "@/server/services/notification-service";

/** Which transport is live, and whether its credentials actually work. */
export async function GET() {
  return handler(async () => {
    await requirePermission("admin:connectors");
    return NextResponse.json(await verifyMailTransport());
  });
}

/**
 * Sends one real message to a named address, so an operator can confirm
 * delivery end to end before a client's invite depends on it.
 */
export async function POST(request: NextRequest) {
  return handler<unknown>(async () => {
    await requirePermission("admin:connectors");
    const parsed = z
      .object({ to: z.string().trim().email() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, detail: "Give a valid address." }, { status: 422 });
    }

    const status = await verifyMailTransport();
    const sent = await sendEmail({
      to: parsed.data.to,
      subject: "SENSO mail test",
      html:
        `<p>This is a test message from SENSO.</p>` +
        `<p>Transport: <strong>${status.transport}</strong>. ` +
        `Delivery tracking: <strong>${status.tracksDelivery ? "available" : "not available"}</strong>.</p>` +
        `<p>If you are reading this, invites, password resets, digests, outreach and scheduled reports can reach a real inbox.</p>`,
    });

    return NextResponse.json({ ok: sent, transport: status.transport, to: parsed.data.to });
  });
}
