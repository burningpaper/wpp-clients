type StaleContact = {
  id: string;
  name: string;
  org: string;
  lastUpdated: string;
  updateUrl: string;
};

type DigestEmailProps = {
  recipientName: string;
  staleContacts: StaleContact[];
};

export function stalenessDigestEmail({
  recipientName,
  staleContacts,
}: DigestEmailProps): string {
  const rows = staleContacts
    .map(
      (c) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: #111827;">${c.name}</strong><br/>
        <span style="color: #6b7280; font-size: 13px;">${c.org}</span>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px;">
        ${c.lastUpdated}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <a href="${c.updateUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 5px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;">
          Update now →
        </a>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #1e3a5f; padding: 28px 32px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 32px; height: 32px; background: #2563eb; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-weight: bold; font-size: 16px;">W</span>
        </div>
        <span style="color: white; font-weight: 600; font-size: 16px;">WPP SA Intelligence</span>
      </div>
      <h1 style="color: white; margin: 16px 0 4px; font-size: 22px; font-weight: 600;">
        Weekly staleness digest
      </h1>
      <p style="color: #93c5fd; margin: 0; font-size: 14px;">
        ${staleContacts.length} contact${staleContacts.length === 1 ? "" : "s"} haven't been updated in 90+ days
      </p>
    </div>

    <!-- Body -->
    <div style="padding: 28px 32px;">
      <p style="color: #374151; margin: 0 0 20px; font-size: 15px;">
        Hi ${recipientName},
      </p>
      <p style="color: #374151; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
        The following contacts in the WPP SA database haven't been updated recently.
        As your agency's data champion, a quick update on each one keeps the intelligence current for everyone across the group.
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 12px; background: #f3f4f6; color: #6b7280; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Contact</th>
            <th style="text-align: left; padding: 8px 12px; background: #f3f4f6; color: #6b7280; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Last updated</th>
            <th style="padding: 8px 12px; background: #f3f4f6;"></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="color: #9ca3af; margin: 28px 0 0; font-size: 13px; line-height: 1.6;">
        You're receiving this because you're the data champion for your agency.
        Updates help WPP SA pitch teams, new business leads, and the CEO/MD understand our portfolio relationships.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; margin: 0; font-size: 12px;">WPP SA Intelligence Database · Internal use only</p>
    </div>

  </div>
</body>
</html>`;
}
