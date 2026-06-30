export const emailTablePlan = [
  {
    table: "CampaignEmails",
    key: "emailId",
    purpose: "Reusable email subject/body records that Lambda can render and send."
  },
  {
    table: "CampaignEmailAssignments",
    key: "campaignId + stepKey",
    purpose: "One-to-many campaign mapping, including send step, persona, date, and placeholder overrides."
  },
  {
    table: "CampaignEmailVersions",
    key: "emailId + version",
    purpose: "Immutable edit history so the sent copy can always be reconstructed."
  },
  {
    table: "CampaignSenderProfiles",
    key: "ownerId",
    purpose: "Sender name, title, from-address, and owner-specific calendar booking link."
  }
];

export const ownerSenderProfiles = {
  amaan: {
    ownerId: "amaan",
    name: "Amaan Karim",
    title: "Sales Consultant",
    email: "amaan.karim@cloudwrxs.com",
    calendarLink: "https://calendar.app.google/CoJd6ZYRzxas1HYYA"
  },
  abdul: {
    ownerId: "abdul",
    name: "Abdul Basit",
    title: "Senior Account Executive - MENA",
    email: "abdul.basit@cloudwrxs.com",
    calendarLink: "https://calendar.app.google/REPLACE_WITH_ABDUL_CALENDAR"
  }
};

export const initialEmailTemplates = [
  {
    emailId: "email_windows_sdp_c1_001",
    internalRef: "windows-sdp-c1-email-1-cto",
    label: "Email 1A - CTO Windows modernisation",
    subject: "Is your Windows infrastructure ready for the next decade?",
    bodyText: `Dear {{FIRST_NAME}},

Many organisations across the Kingdom are reviewing Windows Server environments as licensing costs rise, infrastructure ages, and resilience requirements become more demanding.

At cloudwrxs, we help technology teams modernise Windows workloads on AWS, using the AWS Software Discount Program (SDP) to reduce cost while improving performance, security, and availability.

Our Windows modernisation approach helps you:

* Identify workloads suitable for AWS EC2 migration
* Reduce Windows licensing and infrastructure cost
* Improve HA/DR for critical Windows systems
* Strengthen security with AWS-native controls
* Build a practical roadmap without committing to a full migration upfront

As part of this campaign, we are offering a complimentary Windows Estate Assessment.

{{WEBSITE_LINK}}

{{CALENDAR_LINK}}`,
    status: "approved",
    channel: "email",
    clonedFromEmailId: null,
    createdBy: "md-import",
    updatedAt: "2026-05-28T00:00:00.000Z"
  },
  {
    emailId: "email_windows_sdp_c1_002",
    internalRef: "windows-sdp-c1-email-2-followup",
    label: "Email 2 - SDP savings follow-up",
    subject: "Re: Windows modernisation and SDP savings",
    bodyText: `Dear {{FIRST_NAME}},

Following up on my previous note regarding Windows infrastructure modernisation.

Many teams we speak with are balancing three priorities: reducing Windows licensing cost, improving resilience, and avoiding disruption to critical systems.

With cloudwrxs and AWS SDP, the starting point is not a full migration commitment. It is a practical assessment of your current Windows estate, including:

* Current server footprint and utilisation
* Licensing and infrastructure cost baseline
* HA/DR and backup readiness
* Security and compliance considerations
* Candidate workloads for AWS EC2

From there, we can show where savings, simplification, and risk reduction may be possible.

{{WEBSITE_LINK}}

{{CALENDAR_LINK}}`,
    status: "draft",
    channel: "email",
    clonedFromEmailId: null,
    createdBy: "md-import",
    updatedAt: "2026-05-28T00:00:00.000Z"
  },
  {
    emailId: "email_business_continuity_003",
    internalRef: "gcc-continuity-email-3-risk-gaps",
    label: "Email 3 - Continuity risk gaps",
    subject: "Most teams aren’t prepared…Are you?",
    bodyText: `Most organisations we speak to believe they’re covered on continuity, but when we look closer, there are still critical gaps that would impact uptime, compliance, and recovery if another regional disruption occurred.

Right now, businesses operating across the GCC are actively addressing this, removing single points of failure and putting guaranteed recovery outcomes in place.

If you haven’t stress-tested your current setup recently, there’s a high chance you’re carrying more risk than you think.

Here’s a quick overview of how we approach this:

{{WEBSITE_LINK}}

Allow our team 20 minutes of your time and we’ll show you exactly where organisations like yours are exposed, and what they’re doing to fix it.

{{CALENDAR_LINK}}`,
    status: "approved",
    channel: "email",
    clonedFromEmailId: null,
    createdBy: "lambda-import",
    updatedAt: "2026-05-28T00:00:00.000Z"
  }
];

export const initialEmailAssignments = [
  {
    campaignId: "campaign-1-windows-sdp-1",
    stepKey: "Email1",
    emailId: "email_windows_sdp_c1_001",
    label: "Week 2 launch email",
    persona: "CTO / Head of IT",
    owner: "amaan",
    sendDate: "2026-05-08",
    enabled: true,
    placeholderValues: {
      WEBSITE_LINK: "https://cloudwrxs.com/homepage-cto/?link=website"
    }
  },
  {
    campaignId: "campaign-1-windows-sdp-1",
    stepKey: "Email2",
    emailId: "email_windows_sdp_c1_002",
    label: "Week 3 savings follow-up",
    persona: "All personas",
    owner: "abdul",
    sendDate: "2026-05-15",
    enabled: true,
    placeholderValues: {
      WEBSITE_LINK: "https://cloudwrxs.com/finops?link=website"
    }
  },
  {
    campaignId: "campaign-1-windows-sdp-1",
    stepKey: "Email3",
    emailId: "email_business_continuity_003",
    label: "Week 4 proof/risk follow-up",
    persona: "All personas",
    owner: "amaan",
    sendDate: "2026-05-22",
    enabled: true,
    placeholderValues: {
      WEBSITE_LINK: "https://cloudwrxs.com/ITM?link=website"
    }
  },
  {
    campaignId: "campaign-2-windows-sdp-2",
    stepKey: "Email3",
    emailId: "email_business_continuity_003",
    label: "Shared continuity close",
    persona: "IT Infrastructure Manager",
    owner: "abdul",
    sendDate: "2026-06-22",
    enabled: true,
    placeholderValues: {
      WEBSITE_LINK: "https://cloudwrxs.com/ITM?link=website"
    }
  }
];
