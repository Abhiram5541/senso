import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { listCrm } from "@/server/repositories/crm-repository";
import { listCampaigns } from "@/server/repositories/workspace-repository";
import { listMessages, listTemplates } from "@/server/services/outreach-service";
import { mailTracksDelivery, mailTransport } from "@/server/services/notification-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Notice } from "@/components/ui/states";
import { OutreachComposer } from "@/components/crm/outreach-composer";

export const metadata: Metadata = { title: "Outreach" };
export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const user = await requirePagePermission("outreach:send", "/outreach");
  const transport = mailTransport();
  const mailReady = transport !== "none";
  const tracksDelivery = mailTracksDelivery();

  return (
    <>
      <PageHeader
        eyebrow="Activate"
        title="Outreach"
        description="Email creators from your own relationship records, individually or in bulk. Every send is logged on the creator's timeline, and a creator who has opted out is never contacted."
      />
      <PageBody className="space-y-4">
        {!mailReady && (
          <Notice tone="caution" title="Mail is not configured">
            Sends will be refused until a sender and a transport are set on the server
            (EMAIL_FROM, plus either SMTP_HOST/SMTP_USER/SMTP_PASSWORD or
            RESEND_API_KEY). Everything else here works; nothing is queued silently.
          </Notice>
        )}
        {mailReady && !tracksDelivery && (
          <Notice tone="info" title="Sending over SMTP — delivered, opened and bounced are not tracked">
            SMTP hands a message to a mail server and the protocol reports nothing
            afterwards, so a sent message stays <strong>Sent</strong> rather than advancing
            to Delivered, Opened or Replied. That is the honest state, not a stuck one.
            Bounces will not be recorded either, so an address that stops working will keep
            being mailed until somebody notices. Switch the server to Resend to get those
            back.
          </Notice>
        )}
        <OutreachComposer
          records={listCrm(user)}
          templates={listTemplates(user)}
          campaigns={listCampaigns(user).map((campaign) => ({ id: campaign.id, name: campaign.name }))}
          history={listMessages(user)}
        />
      </PageBody>
    </>
  );
}
