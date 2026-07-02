export const contentAssetTablePlan = [
  {
    table: "CampaignContentAssets",
    key: "assetId",
    purpose: "Reusable WhatsApp messages, call scripts, and future human-assisted campaign content."
  }
];

export const initialWhatsAppTemplates = [
  {
    assetId: "whatsapp_windows_sdp_c2_value_props",
    assetType: "whatsapp",
    internalRef: "windows-sdp-c2-whatsapp-value-props",
    label: "Windows SDP value proposition nudge",
    status: "approved",
    campaignMappings: [
      {
        campaignId: "campaign-2-windows-sdp-2",
        stepKey: "WhatsApp1",
        label: "Promote Windows SDP value propositions"
      }
    ],
    bodyText: `Hi {{FIRST_NAME}}, it is {{SENDER_NAME}} from Cloudwrxs.

We are helping AWS customers review Windows workloads and identify where the AWS Software Discount Program can reduce cost while improving resilience.

This short overview may be useful:
{{WEBSITE_LINK}}

Would it be worth scheduling 20 minutes to see whether there is an SDP opportunity in your Windows estate?`,
    launchMode: "manual_whatsapp_business",
    placeholderValues: {
      WEBSITE_LINK: "https://cloudwrxs.com/homepage-cto/?link=whatsapp"
    },
    updatedAt: "2026-06-01T00:00:00.000Z"
  }
];

export const initialCallScripts = [
  {
    assetId: "callscript_windows_sdp_discovery",
    assetType: "call_script",
    internalRef: "windows-sdp-discovery-call-script",
    label: "Windows SDP discovery call script",
    status: "draft",
    campaignMappings: [
      {
        campaignId: "campaign-2-windows-sdp-2",
        stepKey: "Call1",
        label: "Windows SDP discovery follow-up"
      }
    ],
    opening: "Hi {{FIRST_NAME}}, it is {{SENDER_NAME}} from Cloudwrxs. I am calling because we are helping AWS customers review Windows Server workloads and identify where the AWS Software Discount Program may reduce cost.",
    objective: "Qualify whether the account has Windows workloads, whether licensing cost is visible as a problem, and whether there is appetite for a short Windows Estate Assessment.",
    talkTrack: `1. Confirm whether they own or influence Windows infrastructure decisions.
2. Ask whether Windows licensing, SQL Server licensing, resilience, or refresh planning is currently being reviewed.
3. Explain that Cloudwrxs can run a lightweight assessment before any migration commitment.
4. If there is interest, book a 20 minute discovery meeting.
5. If no answer or voicemail, set callback according to the nurture playbook.`,
    qualificationQuestions: `Do you currently run Windows Server or SQL Server workloads that are due for refresh?
Are licensing costs or renewal dates being actively reviewed?
Is AWS already part of the hosting or DR strategy?
Who else would need to be involved in a Windows Estate Assessment?`,
    objectionHandling: `Already on AWS: Great, the SDP review can still identify licensing and workload placement opportunities.
No budget: The assessment is intended to find savings before a project is funded.
Not the right person: Ask who owns Windows infrastructure, cloud economics, or platform operations.`,
    close: "Would it make sense to book 20 minutes with one of our AWS specialists to see if there is a savings or resilience opportunity here?",
    updatedAt: "2026-06-01T00:00:00.000Z"
  }
];
