import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Linkedin,
  Mail,
  MessageCircle,
  PauseCircle,
  Phone,
  PlayCircle,
  PlugZap,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wand2,
  X
} from "lucide-react";
import { contentAssetTablePlan, initialCallScripts, initialWhatsAppTemplates } from "./campaignContentData.js";
import { emailTablePlan, initialEmailAssignments, initialEmailTemplates, ownerSenderProfiles } from "./campaignEmailData.js";
import { benchmarkIdeas, campaigns as generatedCampaigns, generatedAt } from "./generated/campaignData.js";
import "./styles.css";

const tabs = [
  { id: "dashboard", label: "Calendar", icon: CalendarDays },
  { id: "campaigns", label: "Campaigns", icon: Target },
  { id: "audience", label: "Audience", icon: Users },
  { id: "lead-nurture", label: "Lead Nurture", icon: Phone },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "call-scripts", label: "Call Scripts", icon: Phone },
  { id: "send-review", label: "Send Review", icon: PlayCircle },
  { id: "playbooks", label: "Playbooks", icon: Filter },
  { id: "setup", label: "Setup", icon: ClipboardList },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "evaluation", label: "Evaluation", icon: Gauge },
  { id: "settings", label: "Settings", icon: Settings }
];

const channelMeta = {
  email: { icon: Mail, label: "Email", className: "email" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", className: "whatsapp" },
  call: { icon: Phone, label: "Call", className: "call" },
  linkedin: { icon: Linkedin, label: "LinkedIn", className: "linkedin" },
  webinar: { icon: Sparkles, label: "Webinar", className: "webinar" },
  landing: { icon: FileText, label: "Landing", className: "landing" },
  crm: { icon: PlugZap, label: "CRM", className: "crm" },
  task: { icon: CheckCircle2, label: "Task", className: "task" }
};

const calendarTypes = new Set(["email", "whatsapp", "call", "linkedin", "webinar"]);
const fallbackLabels = {
  linkedin: "",
  webinar: "Web",
  landing: "LP",
  crm: "CRM",
  task: "T"
};
const workflowStatuses = [
  { id: "queued", label: "Queued" },
  { id: "wip", label: "WIP" },
  { id: "complete", label: "Complete" },
  { id: "paused", label: "Paused" }
];
const callOutcomes = [
  "No answer",
  "Busy",
  "Voicemail",
  "Connected",
  "Callback requested",
  "Meeting booked",
  "Not interested",
  "Wrong number",
  "Do not contact",
  "Dead"
];
const completedCallOutcomes = new Set(["Connected", "Callback requested", "Meeting booked", "Not interested", "Wrong number", "Do not contact", "Dead"]);
const skippedCallOutcomes = new Set(["Meeting booked", "Not interested", "Do not contact", "Dead"]);
const leadUpcomingWindowDays = 5;
const statusDisplay = {
  active: "WIP",
  wip: "WIP",
  queued: "Queued",
  complete: "Complete",
  paused: "Paused"
};
const campaignStatusFilters = [
  { id: "planned", label: "Planned" },
  { id: "active", label: "Active" },
  { id: "complete", label: "Complete" }
];

const monthOrder = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
const monthStart = Object.fromEntries(monthOrder.map((month, index) => [month, `2026-${String(index + 1).padStart(2, "0")}-01T00:00:00`]));
const defaultMonthIndex = Math.max(0, monthOrder.indexOf(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })));
const scheduleStorageKey = "cloudwrxs-campaign-command-schedule-v3";
const emailStorageKey = "cloudwrxs-campaign-email-store-v1";
const assignmentStorageKey = "cloudwrxs-campaign-email-assignments-v2";
const senderProfileStorageKey = "cloudwrxs-campaign-sender-profiles-v1";
const audienceListStorageKey = "cloudwrxs-campaign-audience-lists-v1";
const audienceContactStorageKey = "cloudwrxs-campaign-audience-contacts-v1";
const contactEngagementStorageKey = "cloudwrxs-campaign-contact-engagement-v1";
const googleSheetSourceStorageKey = "cloudwrxs-campaign-google-sheet-sources-v1";
const integrationSettingsStorageKey = "cloudwrxs-campaign-integration-settings-v1";
const playbookStorageKey = "cloudwrxs-campaign-playbooks-v1";
const whatsappTemplateStorageKey = "cloudwrxs-campaign-whatsapp-templates-v1";
const callScriptStorageKey = "cloudwrxs-campaign-call-scripts-v1";
const authStorageKey = "cloudwrxs-campaign-auth-v1";
const campaignApiUrl = import.meta.env.VITE_CAMPAIGN_API_URL || "";
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || "";
const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || "";
const cognitoRedirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI || window.location.origin;
const cognitoLogoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI || window.location.origin;
const authEnabled = Boolean(cognitoDomain && cognitoClientId);

const audienceFilterFields = [
  { key: "country", label: "Country" },
  { key: "technology", label: "Technology" },
  { key: "persona", label: "Persona" },
  { key: "jobTitle", label: "Job title" },
  { key: "emailDomain", label: "Email domain" },
  { key: "lifecycleStage", label: "Lifecycle stage" },
  { key: "company", label: "Company" },
  { key: "owner", label: "Owner" },
  { key: "emailStatus", label: "Email status" }
];
const audienceSpecialFilterFields = [
  { key: "audienceExclusion", label: "Audience not in" }
];
const audienceFilterOptions = [...audienceFilterFields, ...audienceSpecialFilterFields];
const bulkUpdatableAudienceFields = audienceFilterFields.filter((field) => !["company", "emailStatus"].includes(field.key));
const hubSpotSyncableContactFields = ["company", "country", "email", "firstName", "jobTitle", "lastName", "lifecycleStage", "phone"];

const initialAudienceLists = [
  {
    listId: "audience-hs-windows-ksa",
    name: "Windows estate contacts - KSA",
    sourceType: "hubspot",
    sourceName: "HubSpot list: Windows Infrastructure KSA",
    hubspotListId: "placeholder-windows-ksa",
    googleSheetId: "",
    selectedFields: ["country", "technology", "persona", "lifecycleStage"],
    filters: [
      { field: "country", operator: "equals", value: "Saudi Arabia" },
      { field: "technology", operator: "contains", value: "Windows" }
    ],
    savedAsHubSpotSegment: true,
    associatedCampaignIds: ["campaign-1-windows-sdp-1"],
    status: "ready",
    updatedAt: "2026-05-29T00:00:00.000Z"
  },
  {
    listId: "audience-sheet-finops-gcc",
    name: "FinOps spreadsheet shortlist",
    sourceType: "google_sheets",
    sourceName: "Google Sheet: MDF imports",
    hubspotListId: "",
    googleSheetId: "sheet-placeholder",
    selectedFields: ["country", "persona", "company"],
    filters: [
      { field: "country", operator: "in", value: "UAE, Saudi Arabia, Qatar" },
      { field: "persona", operator: "contains", value: "Finance" }
    ],
    savedAsHubSpotSegment: false,
    associatedCampaignIds: ["campaign-2-windows-sdp-2"],
    status: "draft",
    updatedAt: "2026-05-29T00:00:00.000Z"
  }
];

const initialGoogleSheetSources = [
  {
    sheetSourceId: "sheet-source-mdf-imports",
    name: "MDF imports",
    sheetId: "sheet-placeholder",
    sheetUrl: "",
    tabs: [
      { tabName: "CTO", headerRow: 1, notes: "Technical decision makers" },
      { tabName: "CFO", headerRow: 1, notes: "Finance persona" },
      { tabName: "ITM", headerRow: 1, notes: "IT manager persona" }
    ],
    lastUsedAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z"
  }
];

const initialIntegrationSettings = [
  {
    settingKey: "googleSheets",
    secretName: "",
    serviceAccountEmail: "",
    mode: "service_account",
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    settingKey: "hubspot",
    secretName: "",
    portalName: "",
    portalId: "",
    mode: "service_key",
    syncMode: "lists_and_contacts",
    selectedProperties: ["email", "firstname", "lastname", "phone", "mobilephone", "company", "jobtitle", "country", "lifecyclestage", "hubspot_owner_id"],
    lastTestedAt: "",
    lastTestStatus: "",
    availableProperties: [],
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    settingKey: "justcall",
    secretName: "",
    accountLabel: "Cloudwrxs JustCall",
    dialerMode: "desktop_app",
    hourlyLimit: 1800,
    burstLimit: 30,
    webhookMode: "planned",
    userMappingMode: "email",
    lastTestedAt: "",
    lastTestStatus: "",
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    settingKey: "whatsapp",
    secretName: "",
    accountLabel: "Cloudwrxs WhatsApp Business",
    apiVersion: "v23.0",
    mode: "cloud_api",
    lastTestedAt: "",
    lastTestStatus: "",
    updatedAt: "2026-06-01T00:00:00.000Z"
  }
];

const playbookTriggerOptions = [
  { value: "email.clicked", label: "Email clicked" },
  { value: "email.opened", label: "Email opened" },
  { value: "call.voicemail", label: "Call voicemail" },
  { value: "call.no_answer", label: "Call no answer" },
  { value: "call.connected", label: "Call connected" },
  { value: "whatsapp.read", label: "WhatsApp read" },
  { value: "whatsapp.replied", label: "WhatsApp replied" },
  { value: "linkedin.accepted", label: "LinkedIn accepted" },
  { value: "meeting.booked", label: "Meeting booked" },
  { value: "contact.suppressed", label: "Contact suppressed" }
];
const playbookConditionFields = [
  { value: "persona", label: "Persona" },
  { value: "country", label: "Country" },
  { value: "technology", label: "Technology" },
  { value: "email.opens", label: "Email opens" },
  { value: "email.clicks", label: "Email clicks" },
  { value: "meetingBooked", label: "Meeting booked" },
  { value: "hasPhone", label: "Has phone" },
  { value: "linkedinConnected", label: "LinkedIn connected" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" }
];
const playbookOperators = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "in", label: "is in" },
  { value: "not_in", label: "is not in" },
  { value: "greater_or_equal", label: "is at least" },
  { value: "less_than", label: "is less than" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" }
];
const playbookActionTypes = [
  { value: "create_task", label: "Create manual task" },
  { value: "suppress_remaining", label: "Suppress remaining touches" },
  { value: "defer_task", label: "Defer existing task" },
  { value: "notify_owner", label: "Notify owner" }
];
const playbookActionChannels = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin_connect", label: "LinkedIn connect" },
  { value: "linkedin_message", label: "LinkedIn message" },
  { value: "manual_email", label: "Manual email" },
  { value: "none", label: "No channel" }
];
const playbookOwnerRules = [
  { value: "campaign_assigned_owner", label: "Campaign assigned owner" },
  { value: "hubspot_owner", label: "HubSpot owner" },
  { value: "logged_in_user", label: "Logged-in user" }
];
const initialPlaybooks = [
  {
    playbookId: "playbook-standard-mdf-nurture",
    name: "Standard MDF Nurture",
    description: "Reusable Cloudwrxs campaign orchestration defaults for email engagement, callbacks, LinkedIn, WhatsApp, and suppression.",
    status: "active",
    assignedCampaignIds: [],
    campaignOverrides: {},
    rules: [
      {
        ruleId: "rule-click-create-call",
        enabled: true,
        name: "Clicked email - call within 1 business day",
        trigger: "email.clicked",
        conditions: [
          { field: "meetingBooked", operator: "equals", value: "false" },
          { field: "unsubscribed", operator: "equals", value: "false" }
        ],
        action: { type: "create_task", channel: "call", dueInBusinessDays: 1, owner: "campaign_assigned_owner" }
      },
      {
        ruleId: "rule-open-linkedin",
        enabled: true,
        name: "Opened 3+ times - LinkedIn connect",
        trigger: "email.opened",
        conditions: [
          { field: "email.opens", operator: "greater_or_equal", value: "3" },
          { field: "linkedinConnected", operator: "equals", value: "false" }
        ],
        action: { type: "create_task", channel: "linkedin_connect", dueInBusinessDays: 2, owner: "campaign_assigned_owner" }
      },
      {
        ruleId: "rule-voicemail-callback",
        enabled: true,
        name: "Voicemail - callback next business day",
        trigger: "call.voicemail",
        conditions: [{ field: "hasPhone", operator: "equals", value: "true" }],
        action: { type: "defer_task", channel: "call", dueInBusinessDays: 1, owner: "campaign_assigned_owner" }
      },
      {
        ruleId: "rule-meeting-suppress",
        enabled: true,
        name: "Meeting booked - stop remaining manual touches",
        trigger: "meeting.booked",
        conditions: [],
        action: { type: "suppress_remaining", channel: "none", dueInBusinessDays: 0, owner: "campaign_assigned_owner" }
      }
    ],
    updatedAt: "2026-06-19T00:00:00.000Z"
  }
];

const initialAudienceContacts = [
  {
    listId: "audience-hs-windows-ksa",
    contactId: "hs-1001",
    firstName: "Noura",
    lastName: "Al Saud",
    email: "noura@example.com",
    phone: "+966500000001",
    country: "Saudi Arabia",
    technology: "Windows Server, AWS",
    persona: "CTO",
    jobTitle: "Chief Technology Officer",
    lifecycleStage: "Lead",
    company: "Riyadh Manufacturing Co",
    owner: "amaan"
  },
  {
    listId: "audience-hs-windows-ksa",
    contactId: "hs-1002",
    firstName: "Omar",
    lastName: "Khalid",
    email: "omar@example.com",
    phone: "+966500000002",
    country: "Saudi Arabia",
    technology: "VMware, Windows Server",
    persona: "IT Manager",
    jobTitle: "Infrastructure Manager",
    lifecycleStage: "MQL",
    company: "GCC Logistics Group",
    owner: "abdul"
  },
  {
    listId: "audience-sheet-finops-gcc",
    contactId: "sheet-2001",
    firstName: "Sara",
    lastName: "Hassan",
    email: "sara@example.com",
    phone: "+971500000003",
    country: "UAE",
    technology: "AWS Cost Explorer",
    persona: "CFO",
    jobTitle: "Finance Director",
    lifecycleStage: "Prospect",
    company: "Dubai Retail Holding",
    owner: "amaan"
  }
];

const initialContactEngagement = [
  {
    contactId: "hs-1001",
    eventId: "engagement-seed-1",
    email: "noura@example.com",
    campaignId: "campaign-1-windows-sdp-1",
    eventType: "Open",
    eventAt: "2026-05-29T00:00:00.000Z",
    count: 2
  }
];

function campaignIdOf(campaign) {
  return campaign?.id || campaign?.campaignId;
}

function slugify(value = "campaign") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "campaign";
}

function eventKey(campaign, event) {
  return `${campaignIdOf(campaign)}:${event.id}`;
}

function labelNumber(label = "") {
  return label.match(/\d+/)?.[0] || "";
}

function eventDisplayNumber(campaign, event) {
  const explicit = labelNumber(event.label);
  if (explicit) return explicit;
  if (event.type === "linkedin") {
    return String(campaign.events.filter((item) => item.type === "linkedin").findIndex((item) => item.id === event.id) + 1);
  }
  return fallbackLabels[event.type] || "";
}

function assignmentKeyOf(assignment = {}) {
  return `${assignment.campaignId}:${assignment.stepKey}`;
}

function isCalendarEmailAssignment(assignment = {}) {
  return assignment.enabled !== false && ["calendar_manual", "calendar_auto"].includes(assignment.sendMode) && Boolean(assignment.sendDate);
}

function emailAssignmentEventId(assignment = {}) {
  return `email-assignment-${slugify(assignment.stepKey || assignment.emailId || "email")}`;
}

function emailAssignmentLabel(assignment = {}) {
  const stepKey = String(assignment.stepKey || "Email").trim();
  const compact = stepKey.replace(/^Email\s*/i, "E").replace(/\s+/g, "");
  return compact || "E";
}

function emailAssignmentTitle(assignment = {}, template = {}, audienceList = {}) {
  const label = assignment.label || template.label || template.subject || assignment.stepKey || "Campaign email";
  const audience = audienceList.name || assignment.audienceListName || assignment.audienceListId || "";
  return audience ? `${label} to ${audience}` : label;
}

function emailAssignmentCalendarEvents(assignments = [], templates = [], audienceLists = []) {
  const templateById = new Map(templates.map((template) => [template.emailId, template]));
  const audienceById = new Map(audienceLists.map((list) => [list.listId, list]));
  return assignments
    .filter(isCalendarEmailAssignment)
    .map((assignment) => {
      const template = templateById.get(assignment.emailId) || {};
      const audienceList = audienceById.get(assignment.audienceListId) || {};
      return {
        id: emailAssignmentEventId(assignment),
        emailAssignmentKey: assignmentKeyOf(assignment),
        emailId: assignment.emailId || "",
        audienceListId: assignment.audienceListId || "",
        month: monthLabelForDate(inputValueToDate(assignment.sendDate)),
        week: "Email automation",
        section: assignment.sendMode === "calendar_auto" ? "Automatic email send" : "Manual email send",
        type: "email",
        label: emailAssignmentLabel(assignment),
        title: emailAssignmentTitle(assignment, template, audienceList),
        source: "email_assignment",
        sendMode: assignment.sendMode,
        sendWindow: assignment.sendWindow || "09:00-11:00",
        timezone: assignment.timezone || userTimezone()
      };
    });
}

function getMonthWeeks(month) {
  if (!monthStart[month]) return [];
  const start = new Date(monthStart[month]);
  const year = start.getFullYear();
  const monthIndex = start.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weeks = [];
  let day = 1;

  while (day <= daysInMonth) {
    const firstDate = new Date(year, monthIndex, day);
    const offset = weeks.length === 0 ? (firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1) : 0;
    const span = Math.min(7 - offset, daysInMonth - day + 1);
    const end = day + span - 1;
    const lastDate = new Date(year, monthIndex, end);
    weeks.push({
      label: `W${weeks.length + 1}`,
      range: `${firstDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${lastDate.toLocaleDateString("en-US", { day: "numeric" })}`,
      offset,
      days: Array.from({ length: 7 }, (_, index) => {
        const dayNumber = day + index - offset;
        return dayNumber >= day && dayNumber <= end ? dayNumber : null;
      })
    });
    day = end + 1;
  }

  return weeks;
}

function dateToInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function inputValueToDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function userTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function tomorrowInputDate() {
  return dateToInputValue(addDays(new Date(), 1));
}

function dayDiff(fromDate, toDate) {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((to - from) / 86400000);
}

function monthLabelForDate(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateFromPosition(item) {
  if (!item?.month || !monthStart[item.month]) return null;
  const week = getMonthWeeks(item.month)[item.weekIndex];
  const dayNumber = week?.days[item.dayIndex];
  if (!dayNumber) return null;
  const monthDate = new Date(monthStart[item.month]);
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
}

function positionFromDate(date) {
  const month = monthLabelForDate(date);
  if (!monthOrder.includes(month)) return null;
  const dayNumber = date.getDate();
  const weeks = getMonthWeeks(month);
  const weekIndex = weeks.findIndex((week) => week.days.includes(dayNumber));
  if (weekIndex < 0) return null;
  return {
    month,
    weekIndex,
    dayIndex: weeks[weekIndex].days.indexOf(dayNumber)
  };
}

function getCampaignStartDate(campaign, schedule) {
  const dates = campaign.events
    .map((event) => dateFromPosition(schedule[eventKey(campaign, event)] || {}))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dates[0] || (campaign.startDate ? inputValueToDate(campaign.startDate) : new Date(2026, 0, 1));
}

function buildInitialSchedule(sourceCampaigns = generatedCampaigns) {
  const schedule = {};
  sourceCampaigns.forEach((campaign) => {
    const monthCounters = {};
    campaign.events.forEach((event) => {
      const month = event.month || monthOrder[0];
      monthCounters[month] = monthCounters[month] || {};
      monthCounters[month][event.week] = monthCounters[month][event.week] || 0;
      const indexInWeek = monthCounters[month][event.week]++;
      const monthIndex = Math.max(0, monthOrder.indexOf(month));
      const weekIndex = Math.max(0, Number(event.week.match(/\d+/)?.[0] || 1) - 1);
      const week = getMonthWeeks(month)[weekIndex];
      const availableDays = Math.max(1, 7 - (week?.offset || 0));
      const dayIndex = weekIndex === 0 ? (week?.offset || 0) + (indexInWeek % availableDays) : indexInWeek % 7;
      const isDone = monthIndex < 3 || (monthIndex === 3 && weekIndex < 3);
      const isPaused = event.type === "email" && monthIndex === 3 && weekIndex === 2;
      schedule[eventKey(campaign, event)] = {
        month,
        weekIndex,
        dayIndex,
        status: isPaused ? "paused" : isDone ? "complete" : monthIndex === 3 ? "wip" : "queued"
      };
    });
  });
  return schedule;
}

function loadStoredSchedule(sourceCampaigns = generatedCampaigns) {
  const initial = buildInitialSchedule(sourceCampaigns);
  try {
    const stored = JSON.parse(window.localStorage.getItem(scheduleStorageKey) || "{}");
    return Object.fromEntries(
      Object.entries(initial).map(([key, value]) => [
        key,
        {
          ...value,
          ...(stored[key] || {}),
          status: stored[key]?.status === "active" ? "wip" : stored[key]?.status || value.status
        }
      ])
    );
  } catch {
    return initial;
  }
}

function eventFromActivity(activity, fallbackEvent = {}) {
  return {
    ...fallbackEvent,
    ...activity,
    id: activity.activityId || fallbackEvent.id,
    month: activity.sourceMonth || fallbackEvent.month,
    week: activity.sourceWeek || fallbackEvent.week,
    section: activity.section || fallbackEvent.section || "Activities",
    type: activity.type || fallbackEvent.type || "task",
    label: activity.label ?? fallbackEvent.label ?? "",
    title: activity.title || fallbackEvent.title || "Campaign activity"
  };
}

function composeCampaigns(campaignSetups, campaignActivities, fallbackCampaigns = generatedCampaigns) {
  if (!Array.isArray(campaignSetups) || !campaignSetups.length) return fallbackCampaigns;
  const fallbackById = new Map(fallbackCampaigns.map((campaign) => [campaignIdOf(campaign), campaign]));
  const activitiesByCampaign = new Map();
  campaignActivities.forEach((activity) => {
    if (!activity.campaignId) return;
    const current = activitiesByCampaign.get(activity.campaignId) || [];
    current.push(activity);
    activitiesByCampaign.set(activity.campaignId, current);
  });

  return campaignSetups
    .map((setup) => {
      const id = setup.id || setup.campaignId;
      const fallback = fallbackById.get(id) || {};
      const fallbackEventsById = new Map((fallback.events || []).map((event) => [event.id, event]));
      const activityEvents = (activitiesByCampaign.get(id) || [])
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.plannedDate || "").localeCompare(String(b.plannedDate || "")))
        .map((activity) => eventFromActivity(activity, fallbackEventsById.get(activity.activityId)));
      return {
        ...fallback,
        ...setup,
        id,
        campaignId: id,
        events: activityEvents.length ? activityEvents : fallback.events || []
      };
    })
    .filter((campaign) => campaign.id);
}

function scheduleFromActivities(sourceCampaigns, campaignActivities, fallbackSchedule = buildInitialSchedule(sourceCampaigns)) {
  if (!Array.isArray(campaignActivities) || !campaignActivities.length) return fallbackSchedule;
  const activityMap = new Map(campaignActivities.map((activity) => [`${activity.campaignId}:${activity.activityId}`, activity]));
  const next = {};
  sourceCampaigns.forEach((campaign) => {
    campaign.events.forEach((event) => {
      const key = eventKey(campaign, event);
      const activity = activityMap.get(key);
      const plannedDate = activity?.plannedDate ? inputValueToDate(activity.plannedDate) : null;
      next[key] = {
        ...(fallbackSchedule[key] || {}),
        ...(plannedDate ? positionFromDate(plannedDate) || {} : {}),
        status: activity?.status === "active" ? "wip" : activity?.status || fallbackSchedule[key]?.status || "queued"
      };
    });
  });
  return next;
}

function campaignDashboardStatus(campaign = {}, schedule = {}) {
  const status = String(campaign.status || "active").toLowerCase();
  if (status === "complete") return "complete";
  const startDate = getCampaignStartDate(campaign, schedule);
  if (startDate && dayDiff(new Date(), startDate) > 0) return "planned";
  return "active";
}

function campaignTotals(campaigns = []) {
  return campaigns.reduce(
    (acc, campaign) => {
      acc.touchpoints += campaign.metrics?.plannedTouchpoints || 0;
      acc.contacts += campaign.metrics?.plannedContacts || 0;
      acc.meetings += campaign.metrics?.meetings || 0;
      acc.pipeline += campaign.metrics?.pipeline || 0;
      return acc;
    },
    { touchpoints: 0, contacts: 0, meetings: 0, pipeline: 0 }
  );
}

function campaignCompletion(campaigns = [], schedule = {}) {
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  return Object.entries(schedule).reduce(
    (acc, [key, item]) => {
      const campaignId = key.split(":")[0];
      if (!campaignIds.has(campaignId)) return acc;
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { total: 0, complete: 0, active: 0, queued: 0, wip: 0, paused: 0 }
  );
}

function computedCampaignWorkflowStatus(campaign = {}, schedule = {}) {
  const events = campaign.events || [];
  if (!events.length) return campaign.status || "active";
  const allComplete = events.every((event) => schedule[eventKey(campaign, event)]?.status === "complete");
  const allQueued = events.every((event) => schedule[eventKey(campaign, event)]?.status === "queued");
  if (allComplete) return "complete";
  if (allQueued) return "queued";
  if (["complete", "queued"].includes(String(campaign.status || "").toLowerCase())) return "active";
  return campaign.status || "active";
}

function campaignSetupsForState(sourceCampaigns, schedule) {
  return sourceCampaigns.map(({ events, ...campaign }) => {
    const campaignId = campaignIdOf(campaign);
    const startDate = dateToInputValue(getCampaignStartDate({ ...campaign, events }, schedule));
    return {
      ...campaign,
      id: campaignId,
      campaignId,
      status: campaign.status || "active",
      startDate,
      endDate: campaign.endDate || dateToInputValue(getCampaignEndDate({ ...campaign, events }, schedule))
    };
  });
}

function getCampaignEndDate(campaign, schedule) {
  const dates = campaign.events
    .map((event) => dateFromPosition(schedule[eventKey(campaign, event)] || {}))
    .filter(Boolean)
    .sort((a, b) => b - a);
  return dates[0] || getCampaignStartDate(campaign, schedule);
}

function campaignActivitiesForState(sourceCampaigns, schedule) {
  return sourceCampaigns.flatMap((campaign) =>
    campaign.events.map((event, sortOrder) => {
      const item = schedule[eventKey(campaign, event)] || {};
      const plannedDate = dateFromPosition(item);
      return {
        campaignId: campaignIdOf(campaign),
        activityId: event.id,
        plannedDate: plannedDate ? dateToInputValue(plannedDate) : "",
        status: item.status === "active" ? "wip" : item.status || "queued",
        sortOrder,
        type: event.type,
        label: event.label || "",
        title: event.title,
        section: event.section,
        audienceListId: event.audienceListId || "",
        audienceListName: event.audienceListName || "",
        bounceCount: event.bounceCount || 0,
        clickCount: event.clickCount || 0,
        complaintCount: event.complaintCount || 0,
        deliveredCount: event.deliveredCount || 0,
        emailAssignmentKey: event.emailAssignmentKey || "",
        emailId: event.emailId || "",
        emailLabel: event.emailLabel || "",
        failedCount: event.failedCount || 0,
        lastSentAt: event.lastSentAt || "",
        remainingQueued: event.remainingQueued ?? "",
        resultCounts: event.resultCounts || {},
        resultsIngestedAt: event.resultsIngestedAt || "",
        reviewedAt: event.reviewedAt || "",
        sendMode: event.sendMode || "",
        sendRunId: event.sendRunId || "",
        sendWindow: event.sendWindow || "",
        sentCount: event.sentCount || 0,
        source: event.source || "",
        sourceMonth: event.month,
        sourceWeek: event.week,
        statusDetail: event.statusDetail || "",
        subject: event.subject || "",
        timezone: event.timezone || "",
        uniqueClickCount: event.uniqueClickCount || 0,
        uniqueOpenCount: event.uniqueOpenCount || 0
      };
    })
  );
}

function currency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function placeholderKeys(text = "") {
  return Array.from(text.matchAll(/{{\s*([A-Z0-9_]+)\s*}}/g), (match) => match[1]).filter((key, index, list) => list.indexOf(key) === index);
}

function loadStoredItems(key, fallback) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "null");
    return Array.isArray(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function extractGoogleSheetId(value = "") {
  const trimmed = value.trim();
  return trimmed.match(/\/spreadsheets\/d\/([^/]+)/)?.[1] || trimmed;
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(payload));
  } catch {
    return {};
  }
}

function readStoredAuth() {
  try {
    const auth = JSON.parse(window.localStorage.getItem(authStorageKey) || "null");
    return auth?.idToken && auth.expiresAt > Date.now() ? auth : null;
  } catch {
    return null;
  }
}

function completeHostedUiLogin() {
  if (!window.location.hash.includes("id_token")) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const idToken = params.get("id_token");
  const accessToken = params.get("access_token");
  const expiresIn = Number(params.get("expires_in") || 3600);
  if (!idToken) return null;
  const claims = decodeJwtPayload(idToken);
  const auth = {
    idToken,
    accessToken,
    email: claims.email,
    name: claims.name || claims.email,
    expiresAt: Date.now() + expiresIn * 1000
  };
  window.localStorage.setItem(authStorageKey, JSON.stringify(auth));
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return auth;
}

function signInWithGoogle() {
  const params = new URLSearchParams({
    client_id: cognitoClientId,
    response_type: "token",
    scope: "openid email profile",
    redirect_uri: cognitoRedirectUri,
    identity_provider: "Google"
  });
  window.location.assign(`${cognitoDomain}/oauth2/authorize?${params.toString()}`);
}

function signOutOfCognito() {
  window.localStorage.removeItem(authStorageKey);
  if (!authEnabled) {
    window.location.reload();
    return;
  }
  const params = new URLSearchParams({
    client_id: cognitoClientId,
    logout_uri: cognitoLogoutUri
  });
  window.location.assign(`${cognitoDomain}/logout?${params.toString()}`);
}

function App() {
  const [auth, setAuth] = useState(() => completeHostedUiLogin() || readStoredAuth());
  const [activeTab, setActiveTab] = useState("dashboard");
  const [campaignRecords, setCampaignRecords] = useState(() => generatedCampaigns);
  const [activeCampaignId, setActiveCampaignId] = useState(generatedCampaigns[0]?.id);
  const [visible, setVisible] = useState(() => new Set(generatedCampaigns.map((campaign) => campaign.id)));
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState(() => new Set(campaignStatusFilters.map((status) => status.id)));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(defaultMonthIndex);
  const [schedule, setSchedule] = useState(() => loadStoredSchedule());
  const [activityFeedback, setActivityFeedback] = useState({});
  const [emailTemplates, setEmailTemplates] = useState(() => loadStoredItems(emailStorageKey, initialEmailTemplates));
  const [emailAssignments, setEmailAssignments] = useState(() => loadStoredItems(assignmentStorageKey, initialEmailAssignments));
  const [senderProfiles, setSenderProfiles] = useState(() => loadStoredItems(senderProfileStorageKey, Object.values(ownerSenderProfiles)));
  const [audienceLists, setAudienceLists] = useState(() => loadStoredItems(audienceListStorageKey, initialAudienceLists));
  const [audienceContacts, setAudienceContacts] = useState(() => campaignApiUrl ? [] : loadStoredItems(audienceContactStorageKey, initialAudienceContacts));
  const [audienceContactCounts, setAudienceContactCounts] = useState({});
  const [contactEngagement, setContactEngagement] = useState(() => loadStoredItems(contactEngagementStorageKey, initialContactEngagement));
  const [googleSheetSources, setGoogleSheetSources] = useState(() => loadStoredItems(googleSheetSourceStorageKey, initialGoogleSheetSources));
  const [integrationSettings, setIntegrationSettings] = useState(() => loadStoredItems(integrationSettingsStorageKey, initialIntegrationSettings));
  const [playbooks, setPlaybooks] = useState(() => loadStoredItems(playbookStorageKey, initialPlaybooks));
  const [whatsappTemplates, setWhatsappTemplates] = useState(() => loadStoredItems(whatsappTemplateStorageKey, initialWhatsAppTemplates));
  const [callScripts, setCallScripts] = useState(() => loadStoredItems(callScriptStorageKey, initialCallScripts));
  const [unsubscribers, setUnsubscribers] = useState([]);
  const [emailEvents, setEmailEvents] = useState([]);
  const [deletedAudienceListIds, setDeletedAudienceListIds] = useState([]);
  const [deletedAudienceContacts, setDeletedAudienceContacts] = useState([]);
  const [deletedPlaybookIds, setDeletedPlaybookIds] = useState([]);
  const [deletedContentAssetIds, setDeletedContentAssetIds] = useState([]);
  const [selectedEmailId, setSelectedEmailId] = useState(() => initialEmailTemplates[0]?.emailId);
  const [selectedAudienceListId, setSelectedAudienceListId] = useState(() => initialAudienceLists[0]?.listId);
  const [remoteStateReady, setRemoteStateReady] = useState(!campaignApiUrl);
  const revertSnapshotRef = useRef({
    campaigns: cloneJson(generatedCampaigns),
    schedule: buildInitialSchedule(generatedCampaigns)
  });
  const activeCampaign = campaignRecords.find((campaign) => campaign.id === activeCampaignId) || campaignRecords[0];
  const dashboardCampaigns = useMemo(
    () => campaignRecords.filter((campaign) => dashboardStatusFilter.has(campaignDashboardStatus(campaign, schedule))),
    [campaignRecords, dashboardStatusFilter, schedule]
  );
  const visibleCampaigns = dashboardCampaigns.filter((campaign) => visible.has(campaign.id));
  const selectedMonth = monthOrder[selectedMonthIndex];
  const authHeaders = auth?.idToken ? { Authorization: `Bearer ${auth.idToken}` } : {};

  const totals = useMemo(() => campaignTotals(dashboardCampaigns), [dashboardCampaigns]);

  const completion = useMemo(() => campaignCompletion(dashboardCampaigns, schedule), [dashboardCampaigns, schedule]);

  useEffect(() => {
    window.localStorage.setItem(scheduleStorageKey, JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    if (!campaignApiUrl || (authEnabled && !auth?.idToken)) return;
    let cancelled = false;
    fetch(`${campaignApiUrl}/state`, { headers: authHeaders })
      .then((response) => {
        if (!response.ok) throw new Error(`API load failed: ${response.status}`);
        return response.json();
      })
      .then((state) => {
        if (cancelled) return;
        if (Array.isArray(state.templates) && state.templates.length) {
          setEmailTemplates(state.templates);
          setSelectedEmailId((current) => state.templates.some((template) => template.emailId === current) ? current : state.templates[0].emailId);
        }
        if (Array.isArray(state.assignments)) setEmailAssignments(state.assignments);
        if (Array.isArray(state.senderProfiles) && state.senderProfiles.length) setSenderProfiles(state.senderProfiles);
        if (Array.isArray(state.audienceLists) && state.audienceLists.length) {
          setAudienceLists(state.audienceLists);
          setSelectedAudienceListId((current) => state.audienceLists.some((list) => list.listId === current) ? current : state.audienceLists[0]?.listId);
        }
        if (state.audienceContactCounts) setAudienceContactCounts(state.audienceContactCounts);
        if (Array.isArray(state.audienceContacts) && state.audienceContacts.length) setAudienceContacts(state.audienceContacts);
        if (Array.isArray(state.contactEngagement)) setContactEngagement(state.contactEngagement);
        if (Array.isArray(state.googleSheetSources) && state.googleSheetSources.length) setGoogleSheetSources(state.googleSheetSources);
        if (Array.isArray(state.integrationSettings) && state.integrationSettings.length) setIntegrationSettings(state.integrationSettings);
        if (Array.isArray(state.playbooks) && state.playbooks.length) setPlaybooks(state.playbooks);
        if (Array.isArray(state.contentAssets)) {
          const nextWhatsApp = state.contentAssets.filter((asset) => asset.assetType === "whatsapp");
          const nextCallScripts = state.contentAssets.filter((asset) => asset.assetType === "call_script");
          if (nextWhatsApp.length) setWhatsappTemplates(nextWhatsApp);
          if (nextCallScripts.length) setCallScripts(nextCallScripts);
        }
        if (Array.isArray(state.unsubscribers)) setUnsubscribers(state.unsubscribers);
        if (Array.isArray(state.emailEvents)) setEmailEvents(state.emailEvents);
        if (Array.isArray(state.campaignSetups) && state.campaignSetups.length) {
          const nextCampaigns = composeCampaigns(state.campaignSetups, state.campaignActivities || []);
          const nextSchedule = scheduleFromActivities(nextCampaigns, state.campaignActivities || [], loadStoredSchedule(nextCampaigns));
          revertSnapshotRef.current = {
            campaigns: cloneJson(nextCampaigns),
            schedule: cloneJson(nextSchedule)
          };
          setCampaignRecords(nextCampaigns);
          setSchedule(nextSchedule);
          setVisible((current) => {
            const currentIds = new Set(nextCampaigns.filter((campaign) => current.has(campaign.id)).map((campaign) => campaign.id));
            return currentIds.size ? currentIds : new Set(nextCampaigns.map((campaign) => campaign.id));
          });
          setActiveCampaignId((current) => nextCampaigns.some((campaign) => campaign.id === current) ? current : nextCampaigns[0]?.id);
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) setRemoteStateReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.idToken]);

  useEffect(() => {
    window.localStorage.setItem(emailStorageKey, JSON.stringify(emailTemplates));
  }, [emailTemplates]);

  useEffect(() => {
    window.localStorage.setItem(assignmentStorageKey, JSON.stringify(emailAssignments));
  }, [emailAssignments]);

  useEffect(() => {
    window.localStorage.setItem(senderProfileStorageKey, JSON.stringify(senderProfiles));
  }, [senderProfiles]);

  useEffect(() => {
    window.localStorage.setItem(audienceListStorageKey, JSON.stringify(audienceLists));
  }, [audienceLists]);

  useEffect(() => {
    if (!campaignApiUrl) window.localStorage.setItem(audienceContactStorageKey, JSON.stringify(audienceContacts));
  }, [audienceContacts]);

  useEffect(() => {
    window.localStorage.setItem(contactEngagementStorageKey, JSON.stringify(contactEngagement));
  }, [contactEngagement]);

  useEffect(() => {
    window.localStorage.setItem(googleSheetSourceStorageKey, JSON.stringify(googleSheetSources));
  }, [googleSheetSources]);

  useEffect(() => {
    window.localStorage.setItem(integrationSettingsStorageKey, JSON.stringify(integrationSettings));
  }, [integrationSettings]);

  useEffect(() => {
    window.localStorage.setItem(playbookStorageKey, JSON.stringify(playbooks));
  }, [playbooks]);

  useEffect(() => {
    window.localStorage.setItem(whatsappTemplateStorageKey, JSON.stringify(whatsappTemplates));
  }, [whatsappTemplates]);

  useEffect(() => {
    window.localStorage.setItem(callScriptStorageKey, JSON.stringify(callScripts));
  }, [callScripts]);

  useEffect(() => {
    setCampaignRecords((current) => {
      let changed = false;
      const next = current.map((campaign) => {
        const nextStatus = computedCampaignWorkflowStatus(campaign, schedule);
        if ((campaign.status || "active") === nextStatus) return campaign;
        changed = true;
        return {
          ...campaign,
          status: nextStatus
        };
      });
      return changed ? next : current;
    });
  }, [schedule]);

  useEffect(() => {
    if (!remoteStateReady) return;
    const emailEventsByCampaign = new Map();
    emailAssignmentCalendarEvents(emailAssignments, emailTemplates, audienceLists).forEach((event) => {
      const campaignId = event.emailAssignmentKey.split(":")[0];
      const current = emailEventsByCampaign.get(campaignId) || [];
      current.push(event);
      emailEventsByCampaign.set(campaignId, current);
    });
    const activeGeneratedCalendarKeys = new Set(
      Array.from(emailEventsByCampaign.entries()).flatMap(([campaignId, events]) => events.map((event) => `${campaignId}:${event.id}`))
    );

    setCampaignRecords((current) => {
      let changed = false;
      const nextCampaigns = current.map((campaign) => {
        const generatedEvents = (emailEventsByCampaign.get(campaign.id) || []).sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const existingEvents = campaign.events || [];
        const preservedEvents = existingEvents.filter((event) => event.source !== "email_assignment" || activeGeneratedCalendarKeys.has(`${campaign.id}:${event.id}`));
        const generatedById = new Map(generatedEvents.map((event) => [event.id, event]));
        const mergedEvents = preservedEvents.map((event) => generatedById.get(event.id) || event);
        const existingGeneratedIds = new Set(mergedEvents.filter((event) => event.source === "email_assignment").map((event) => event.id));
        generatedEvents.forEach((event) => {
          if (!existingGeneratedIds.has(event.id)) mergedEvents.push(event);
        });
        if (JSON.stringify(existingEvents) !== JSON.stringify(mergedEvents)) changed = true;
        return changed ? { ...campaign, events: mergedEvents } : campaign;
      });
      return changed ? nextCampaigns : current;
    });

    setSchedule((current) => {
      let changed = false;
      const next = { ...current };
      campaignRecords.forEach((campaign) => {
        (campaign.events || []).forEach((event) => {
          if (event.source === "email_assignment" && !activeGeneratedCalendarKeys.has(`${campaign.id}:${event.id}`)) {
            delete next[eventKey(campaign, event)];
            changed = true;
          }
        });
      });
      emailAssignmentCalendarEvents(emailAssignments, emailTemplates, audienceLists).forEach((event) => {
        const campaignId = event.emailAssignmentKey.split(":")[0];
        const assignment = emailAssignments.find((item) => assignmentKeyOf(item) === event.emailAssignmentKey);
        const date = assignment?.sendDate ? inputValueToDate(assignment.sendDate) : null;
        const position = date ? positionFromDate(date) : null;
        if (!position) return;
        const key = `${campaignId}:${event.id}`;
        const currentItem = next[key] || {};
        const target = { ...currentItem, ...position, status: currentItem.status || "queued" };
        if (JSON.stringify(currentItem) !== JSON.stringify(target)) {
          next[key] = target;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [emailAssignments, emailTemplates, audienceLists, remoteStateReady]);

  useEffect(() => {
    if (!campaignApiUrl || !remoteStateReady || (authEnabled && !auth?.idToken)) return;
    const timeoutId = window.setTimeout(() => {
      fetch(`${campaignApiUrl}/state`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          campaignSetups: campaignSetupsForState(campaignRecords, schedule),
          campaignActivities: campaignActivitiesForState(campaignRecords, schedule),
          templates: emailTemplates,
          assignments: emailAssignments,
          senderProfiles,
          audienceLists,
          contactEngagement,
          googleSheetSources,
          integrationSettings,
          playbooks,
          contentAssets: [...whatsappTemplates, ...callScripts],
          deletedAudienceListIds,
          deletedAudienceContacts,
          deletedPlaybookIds,
          deletedContentAssetIds
        })
      })
        .then((response) => {
          if (!response.ok) throw new Error(`API save failed: ${response.status}`);
          if (deletedAudienceListIds.length) setDeletedAudienceListIds([]);
          if (deletedAudienceContacts.length) setDeletedAudienceContacts([]);
          if (deletedPlaybookIds.length) setDeletedPlaybookIds([]);
          if (deletedContentAssetIds.length) setDeletedContentAssetIds([]);
        })
        .catch((error) => console.error(error));
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [
    campaignRecords,
    schedule,
    emailTemplates,
    emailAssignments,
    senderProfiles,
    audienceLists,
    contactEngagement,
    googleSheetSources,
    integrationSettings,
    playbooks,
    whatsappTemplates,
    callScripts,
    deletedAudienceListIds,
    deletedAudienceContacts,
    deletedPlaybookIds,
    deletedContentAssetIds,
    remoteStateReady,
    auth?.idToken
  ]);

  function toggleCampaign(id) {
    setVisible((nextVisible) => {
      const next = new Set(nextVisible);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function moveMonth(direction) {
    setSelectedMonthIndex((index) => Math.min(monthOrder.length - 1, Math.max(0, index + direction)));
  }

  function toggleDashboardStatusFilter(statusId, checked) {
    setDashboardStatusFilter((current) => {
      const next = new Set(current);
      if (statusId === "all") {
        return checked ? new Set(campaignStatusFilters.map((status) => status.id)) : new Set();
      }
      if (checked) next.add(statusId);
      else next.delete(statusId);
      return next;
    });
  }

  function moveEvent(key, position) {
    setSchedule((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...position,
        status: current[key]?.status === "complete" ? "wip" : current[key]?.status || "queued"
      }
    }));
    syncEmailAssignmentDateFromCalendarMove(key, position);
  }

  function syncEmailAssignmentDateFromCalendarMove(key, position) {
    const [campaignId, ...activityParts] = String(key || "").split(":");
    const activityId = activityParts.join(":");
    const campaign = campaignRecords.find((item) => item.id === campaignId);
    const event = campaign?.events?.find((item) => item.id === activityId);
    if (event?.source !== "email_assignment") return;
    const nextDate = dateFromPosition(position);
    if (!nextDate) return;
    const nextDateValue = dateToInputValue(nextDate);
    setEmailAssignments((current) =>
      current.map((assignment) =>
        assignment.campaignId === campaignId && emailAssignmentEventId(assignment) === activityId
          ? {
              ...assignment,
              sendDate: nextDateValue
            }
          : assignment
      )
    );
  }

  function updateEventStatus(key, status) {
    setSchedule((current) => ({
      ...current,
      [key]: { ...current[key], status }
    }));
  }

  function changeCampaignStartDate(campaign, newStartValue) {
    const currentStart = getCampaignStartDate(campaign, schedule);
    const newStart = inputValueToDate(newStartValue);
    const delta = dayDiff(currentStart, newStart);
    if (!Number.isFinite(delta) || delta === 0) return;

    setSchedule((current) => {
      const next = { ...current };
      campaign.events.forEach((event) => {
        const key = eventKey(campaign, event);
        const item = current[key];
        const currentDate = dateFromPosition(item || {});
        if (!item || !currentDate) return;
        const shifted = positionFromDate(addDays(currentDate, delta));
        if (!shifted) return;
        next[key] = {
          ...item,
          ...shifted
        };
      });
      return next;
    });

    const newMonthIndex = monthOrder.indexOf(monthLabelForDate(newStart));
    if (newMonthIndex >= 0) setSelectedMonthIndex(newMonthIndex);
  }

  function updateCampaign(campaignId, field, value) {
    if (field === "status" && ["queued", "complete"].includes(value)) {
      const targetCampaign = campaignRecords.find((campaign) => campaign.id === campaignId);
      if (targetCampaign) {
        setSchedule((current) => {
          const next = { ...current };
          (targetCampaign.events || []).forEach((event) => {
            const key = eventKey(targetCampaign, event);
            next[key] = {
              ...(current[key] || { month: event.month, weekIndex: 0, dayIndex: 0 }),
              status: value
            };
          });
          return next;
        });
      }
    }
    setCampaignRecords((current) =>
      current.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              [field]: value
            }
          : campaign
      )
    );
  }

  function updateCampaignMetric(campaignId, metric, value) {
    const numericValue = Number(value);
    setCampaignRecords((current) =>
      current.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              metrics: {
                ...campaign.metrics,
                [metric]: Number.isFinite(numericValue) ? numericValue : 0
              }
            }
          : campaign
      )
    );
  }

  function createCampaignFromSetup(draft) {
    const timestamp = Date.now();
    const name = draft.name?.trim() || "New campaign";
    const shortName = draft.shortName?.trim() || name;
    const startDateValue = draft.startDate || dateToInputValue(new Date(2026, 0, 1));
    const startDate = inputValueToDate(startDateValue);
    const startPosition = positionFromDate(startDate) || { month: monthLabelForDate(startDate), weekIndex: 0, dayIndex: 0 };
    const channelTypes = Array.isArray(draft.channelTypes) && draft.channelTypes.length ? draft.channelTypes : ["email", "call", "landing"];
    const campaignId = `campaign-${slugify(shortName)}-${timestamp}`;
    const paletteIndex = campaignRecords.length % 4;
    const palettes = [
      ["#0f6e56", "#b9e8d6", "#05372e"],
      ["#356fa8", "#d7e8fb", "#183a5a"],
      ["#b36a28", "#f6dfbd", "#523010"],
      ["#7a5ea8", "#e8def9", "#33224f"]
    ];
    const [color, bg, textColor] = palettes[paletteIndex];
    const events = channelTypes.map((type, index) => ({
      id: `setup-${timestamp}-${index + 1}`,
      month: startPosition.month,
      week: `Week ${Math.floor(index / 2) + 1}`,
      section: index === 0 ? "Setup" : "Activities",
      type,
      label: type === "email" ? `E${index + 1}` : "",
      title: `${channelMeta[type]?.label || "Task"} ${index + 1}: ${shortName}`
    }));
    const campaign = {
      id: campaignId,
      name,
      shortName,
      folder: draft.folder || slugify(shortName),
      color,
      bg,
      textColor,
      budget: draft.budget || "",
      objective: draft.objective || "",
      personas: String(draft.personas || "").split(",").map((item) => item.trim()).filter(Boolean),
      files: draft.files?.length ? draft.files : [],
      status: "draft",
      events,
      metrics: {
        plannedTouchpoints: events.length,
        plannedContacts: Number(draft.plannedContacts) || 0,
        meetings: Number(draft.meetings) || 0,
        pipeline: Number(draft.pipeline) || 0,
        opens: 0,
        clicks: 0,
        linkedin: events.filter((event) => event.type === "linkedin").length
      }
    };

    setCampaignRecords((current) => [campaign, ...current]);
    setSchedule((current) => {
      const next = { ...current };
      events.forEach((event, index) => {
        const eventDate = addDays(startDate, index * 3);
        const position = positionFromDate(eventDate) || startPosition;
        next[eventKey(campaign, event)] = {
          ...position,
          status: "queued"
        };
      });
      return next;
    });
    setVisible((current) => new Set([...current, campaignId]));
    setActiveCampaignId(campaignId);
    const nextMonthIndex = monthOrder.indexOf(monthLabelForDate(startDate));
    if (nextMonthIndex >= 0) setSelectedMonthIndex(nextMonthIndex);
  }

  function updateCampaignFromSetup(campaignId, draft) {
    if (!campaignId) return;
    setCampaignRecords((current) =>
      current.map((campaign) => {
        if (campaign.id !== campaignId) return campaign;
        const nextName = draft.name?.trim() || campaign.name;
        const nextShortName = draft.shortName?.trim() || campaign.shortName || nextName;
        const nextPersonas = String(draft.personas || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        return {
          ...campaign,
          name: nextName,
          shortName: nextShortName,
          folder: draft.folder || campaign.folder || slugify(nextShortName),
          budget: draft.budget || campaign.budget,
          objective: draft.objective || campaign.objective,
          personas: nextPersonas.length ? nextPersonas : campaign.personas,
          files: draft.files?.length ? draft.files : campaign.files
        };
      })
    );
  }

  function updateCampaignEvent(campaign, targetEvent, field, value) {
    setCampaignRecords((current) =>
      current.map((item) =>
        item.id === campaign.id
          ? {
              ...item,
              events: item.events.map((event) =>
                event.id === targetEvent.id
                  ? {
                      ...event,
                      [field]: value
                    }
                  : event
              )
            }
          : item
      )
    );
  }

  function updateCampaignEventDate(campaign, targetEvent, value) {
    const nextPosition = positionFromDate(inputValueToDate(value));
    if (!nextPosition) return;
    moveEvent(eventKey(campaign, targetEvent), nextPosition);
    flashActivityRows([eventKey(campaign, targetEvent)]);
  }

  function addCampaignEvent(campaign) {
    const activityId = `activity-${Date.now()}`;
    const startDate = getCampaignStartDate(campaign, schedule);
    const nextPosition = positionFromDate(startDate) || { month: selectedMonth, weekIndex: 0, dayIndex: 0 };
    const newEvent = {
      id: activityId,
      month: nextPosition.month,
      week: `Week ${nextPosition.weekIndex + 1}`,
      section: "Activities",
      type: "email",
      label: "",
      title: "New campaign activity"
    };

    setCampaignRecords((current) =>
      current.map((item) =>
        item.id === campaign.id
          ? {
              ...item,
              events: [...item.events, newEvent]
            }
          : item
      )
    );
    setSchedule((current) => ({
      ...current,
      [eventKey(campaign, newEvent)]: {
        ...nextPosition,
        status: "queued"
      }
    }));
    flashActivityRows([eventKey(campaign, newEvent)]);
  }

  function createCampaignComponent(campaignId, overrides = {}) {
    const campaign = campaignRecords.find((item) => item.id === campaignId);
    if (!campaign) return null;
    const type = overrides.type || "task";
    const typeCount = campaign.events.filter((event) => event.type === type).length;
    const plannedDate = overrides.plannedDate ? inputValueToDate(overrides.plannedDate) : addDays(getCampaignEndDate(campaign, schedule), 1);
    const nextPosition = positionFromDate(plannedDate) || positionFromDate(getCampaignStartDate(campaign, schedule)) || { month: selectedMonth, weekIndex: 0, dayIndex: 0 };
    const newEvent = {
      id: overrides.id || `activity-${Date.now()}`,
      month: nextPosition.month,
      week: `Week ${nextPosition.weekIndex + 1}`,
      section: overrides.section || "Activities",
      type,
      label: overrides.label || `${channelMeta[type]?.label || "Task"}${typeCount + 1}`,
      title: overrides.title || `New ${channelMeta[type]?.label || "campaign"} activity`
    };

    setCampaignRecords((current) =>
      current.map((item) =>
        item.id === campaignId
          ? {
              ...item,
              events: [...item.events, newEvent]
            }
          : item
      )
    );
    setSchedule((current) => ({
      ...current,
      [eventKey(campaign, newEvent)]: {
        ...nextPosition,
        status: "queued"
      }
    }));
    flashActivityRows([eventKey(campaign, newEvent)]);
    return newEvent;
  }

  function flashActivityRows(keys, effect = "confirm") {
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
    if (!uniqueKeys.length) return;
    setActivityFeedback((current) => ({
      ...current,
      ...Object.fromEntries(uniqueKeys.map((key) => [key, effect]))
    }));
    window.setTimeout(() => {
      setActivityFeedback((current) => {
        const next = { ...current };
        uniqueKeys.forEach((key) => {
          delete next[key];
        });
        return next;
      });
    }, 680);
  }

  function revertCampaign(campaign) {
    const snapshotCampaign = revertSnapshotRef.current.campaigns.find((item) => item.id === campaign.id);
    if (!snapshotCampaign) return;

    setCampaignRecords((current) => current.map((item) => (item.id === campaign.id ? cloneJson(snapshotCampaign) : item)));
    setSchedule((current) => {
      const next = { ...current };
      campaign.events.forEach((event) => {
        delete next[eventKey(campaign, event)];
      });
      snapshotCampaign.events.forEach((event) => {
        const key = eventKey(snapshotCampaign, event);
        next[key] = cloneJson(revertSnapshotRef.current.schedule[key] || { month: event.month, weekIndex: 0, dayIndex: 0, status: "queued" });
      });
      return next;
    });
  }

  function flashActivityMap(feedbackMap) {
    const entries = Object.entries(feedbackMap).filter(([key]) => key);
    if (!entries.length) return;
    setActivityFeedback((current) => ({
      ...current,
      ...Object.fromEntries(entries)
    }));
    window.setTimeout(() => {
      setActivityFeedback((current) => {
        const next = { ...current };
        entries.forEach(([key]) => {
          delete next[key];
        });
        return next;
      });
    }, 720);
  }

  function duplicateCampaignEvent(campaign, sourceEvent) {
    const sourceIndex = campaign.events.findIndex((event) => event.id === sourceEvent.id);
    if (sourceIndex < 0) return;
    const newEvent = {
      ...sourceEvent,
      id: `activity-${Date.now()}`,
      title: `${sourceEvent.title || "Campaign activity"} copy`
    };

    setCampaignRecords((current) =>
      current.map((item) =>
        item.id === campaign.id
          ? {
              ...item,
              events: [...item.events.slice(0, sourceIndex + 1), newEvent, ...item.events.slice(sourceIndex + 1)]
            }
          : item
      )
    );
    setSchedule((current) => ({
      ...current,
      [eventKey(campaign, newEvent)]: {
        ...(current[eventKey(campaign, sourceEvent)] || {}),
        status: "queued"
      }
    }));
    flashActivityRows([eventKey(campaign, sourceEvent), eventKey(campaign, newEvent)]);
  }

  function moveCampaignEvent(campaign, sourceEvent, direction) {
    const fromIndex = campaign.events.findIndex((event) => event.id === sourceEvent.id);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= campaign.events.length) return;
    const nextEvents = [...campaign.events];
    const [movedEvent] = nextEvents.splice(fromIndex, 1);
    nextEvents.splice(toIndex, 0, movedEvent);

    setCampaignRecords((current) => current.map((item) => (item.id === campaign.id ? { ...item, events: nextEvents } : item)));
    setSchedule((current) => {
      const next = { ...current };
      const originalSlots = campaign.events.map((event) => current[eventKey(campaign, event)]).filter(Boolean);
      nextEvents.forEach((event, index) => {
        const slot = originalSlots[index];
        if (slot) next[eventKey(campaign, event)] = { ...slot };
      });
      return next;
    });
    const swappedEvent = campaign.events[toIndex];
    flashActivityMap({
      [eventKey(campaign, movedEvent)]: direction < 0 ? "move-up" : "move-down",
      [eventKey(campaign, swappedEvent)]: direction < 0 ? "move-down" : "move-up"
    });
  }

  function deleteCampaignEvent(campaign, targetEvent) {
    const removeIndex = campaign.events.findIndex((event) => event.id === targetEvent.id);
    if (removeIndex < 0) return;
    const nextEvents = campaign.events.filter((event) => event.id !== targetEvent.id);

    setCampaignRecords((current) => current.map((item) => (item.id === campaign.id ? { ...item, events: nextEvents } : item)));
    setSchedule((current) => {
      const next = { ...current };
      const originalSlots = campaign.events.map((event) => current[eventKey(campaign, event)]).filter(Boolean);
      delete next[eventKey(campaign, targetEvent)];
      nextEvents.forEach((event, index) => {
        const slot = originalSlots[index];
        if (index >= removeIndex && slot) next[eventKey(campaign, event)] = { ...slot };
      });
      return next;
    });
    flashActivityRows(nextEvents.slice(removeIndex).map((event) => eventKey(campaign, event)));
  }

  if (authEnabled && !auth) {
    return <AuthGate onSignIn={signInWithGoogle} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <CloudCampLogo />
          <div className="brand-copy">
            <strong>CloudCamp</strong>
            <span>Campaign automation</span>
            <img className="brand-wordmark" src="https://cloudwrxs.com/wp-content/themes/cloudwrxs/assets/images/logo-white.svg" alt="Cloudwrxs" />
          </div>
        </div>
        <nav className="nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sync-card">
          <PlugZap size={18} />
          <div>
            <strong>Source mode</strong>
            <span>DynamoDB stores campaign setup, activity dates, and statuses.</span>
          </div>
        </div>
        {authEnabled && (
          <button
            className="signout-button"
            onClick={() => {
              setAuth(null);
              signOutOfCognito();
            }}
          >
            Sign out {auth?.email}
          </button>
        )}
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeTab === "dashboard" ? "Campaign month" : "Campaign workspace"}</p>
            <h1>{activeTab === "dashboard" ? "Campaign operating dashboard" : tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" title="Previous month" onClick={() => moveMonth(-1)} disabled={selectedMonthIndex === 0}>
              <ChevronLeft size={18} />
            </button>
            <select className="month-readout" value={selectedMonth} onChange={(event) => setSelectedMonthIndex(monthOrder.indexOf(event.target.value))} aria-label="Jump to month">
              {monthOrder.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            {["dashboard", "campaigns"].includes(activeTab) && (
              <div className="campaign-status-filter" aria-label="Filter campaigns by status">
                <label>
                  <input
                    type="checkbox"
                    checked={dashboardStatusFilter.size === campaignStatusFilters.length}
                    onChange={(event) => toggleDashboardStatusFilter("all", event.target.checked)}
                  />
                  <span>All</span>
                </label>
                {campaignStatusFilters.map((status) => (
                  <label key={status.id}>
                    <input
                      type="checkbox"
                      checked={dashboardStatusFilter.has(status.id)}
                      onChange={(event) => toggleDashboardStatusFilter(status.id, event.target.checked)}
                    />
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            )}
            <button className="icon-button" title="Next month" onClick={() => moveMonth(1)} disabled={selectedMonthIndex === monthOrder.length - 1}>
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <Dashboard
            activeCampaign={activeCampaign}
            completion={completion}
            campaigns={dashboardCampaigns}
            month={selectedMonth}
            moveEvent={moveEvent}
            schedule={schedule}
            setActiveCampaignId={setActiveCampaignId}
            totals={totals}
            toggleCampaign={toggleCampaign}
            updateEventStatus={updateEventStatus}
            visible={visible}
            visibleCampaigns={visibleCampaigns}
            onSelectEvent={setSelectedEvent}
          />
        )}
        {activeTab === "campaigns" && (
          <Campaigns
            campaigns={dashboardCampaigns}
            activeCampaignId={activeCampaignId}
            addCampaignEvent={addCampaignEvent}
            activityFeedback={activityFeedback}
            changeCampaignStartDate={changeCampaignStartDate}
            deleteCampaignEvent={deleteCampaignEvent}
            duplicateCampaignEvent={duplicateCampaignEvent}
            moveCampaignEvent={moveCampaignEvent}
            onSelectEvent={setSelectedEvent}
            revertCampaign={revertCampaign}
            schedule={schedule}
            setActiveCampaignId={setActiveCampaignId}
            updateCampaign={updateCampaign}
            updateCampaignEvent={updateCampaignEvent}
            updateCampaignEventDate={updateCampaignEventDate}
            updateCampaignMetric={updateCampaignMetric}
            updateEventStatus={updateEventStatus}
          />
        )}
        {activeTab === "emails" && (
          <EmailWorkspace
            activeCampaignId={activeCampaignId}
            assignments={emailAssignments}
            audienceLists={audienceLists}
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            campaigns={campaignRecords}
            selectedEmailId={selectedEmailId}
            setActiveCampaignId={setActiveCampaignId}
            setAssignments={setEmailAssignments}
            setSelectedEmailId={setSelectedEmailId}
            setTemplates={setEmailTemplates}
            senderProfiles={senderProfiles}
            templates={emailTemplates}
          />
        )}
        {activeTab === "whatsapp" && (
          <WhatsAppWorkspace
            audienceLists={audienceLists}
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            campaigns={campaignRecords}
            createCampaignComponent={createCampaignComponent}
            integrationSettings={integrationSettings}
            senderProfiles={senderProfiles}
            templates={whatsappTemplates}
            setTemplates={setWhatsappTemplates}
            setDeletedContentAssetIds={setDeletedContentAssetIds}
          />
        )}
        {activeTab === "call-scripts" && (
          <CallScriptWorkspace
            campaigns={campaignRecords}
            scripts={callScripts}
            setScripts={setCallScripts}
            setDeletedContentAssetIds={setDeletedContentAssetIds}
          />
        )}
        {activeTab === "send-review" && (
          <SendReviewWorkspace
            activeCampaignId={activeCampaignId}
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            campaigns={campaignRecords}
            setActiveCampaignId={setActiveCampaignId}
          />
        )}
        {activeTab === "playbooks" && (
          <PlaybookWorkspace
            campaigns={campaignRecords}
            playbooks={playbooks}
            setDeletedPlaybookIds={setDeletedPlaybookIds}
            setPlaybooks={setPlaybooks}
          />
        )}
        {activeTab === "audience" && (
          <AudienceWorkspace
            audienceContacts={audienceContacts}
            audienceContactCounts={audienceContactCounts}
            audienceLists={audienceLists}
            campaigns={campaignRecords}
            contactEngagement={contactEngagement}
            emailEvents={emailEvents}
            googleSheetSources={googleSheetSources}
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            selectedAudienceListId={selectedAudienceListId}
            setAudienceContacts={setAudienceContacts}
            setAudienceContactCounts={setAudienceContactCounts}
            setAudienceLists={setAudienceLists}
            setDeletedAudienceContacts={setDeletedAudienceContacts}
            setDeletedAudienceListIds={setDeletedAudienceListIds}
            setGoogleSheetSources={setGoogleSheetSources}
            setSelectedAudienceListId={setSelectedAudienceListId}
            unsubscribers={unsubscribers}
          />
        )}
        {activeTab === "lead-nurture" && (
          <LeadNurtureWorkspace
            activeCampaignId={activeCampaignId}
            audienceContacts={audienceContacts}
            audienceLists={audienceLists}
            auth={auth}
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            campaigns={campaignRecords}
            contactEngagement={contactEngagement}
            emailAssignments={emailAssignments}
            emailEvents={emailEvents}
            integrationSettings={integrationSettings}
            schedule={schedule}
            selectedAudienceListId={selectedAudienceListId}
            senderProfiles={senderProfiles}
            setActiveCampaignId={setActiveCampaignId}
            setAudienceContacts={setAudienceContacts}
            setContactEngagement={setContactEngagement}
            setSelectedAudienceListId={setSelectedAudienceListId}
            unsubscribers={unsubscribers}
          />
        )}
        {activeTab === "setup" && (
          <Setup
            activeCampaign={activeCampaign}
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            campaigns={campaignRecords}
            createCampaignFromSetup={createCampaignFromSetup}
            setActiveCampaignId={setActiveCampaignId}
            updateCampaignFromSetup={updateCampaignFromSetup}
          />
        )}
        {activeTab === "integrations" && (
          <Integrations
            authHeaders={authHeaders}
            campaignApiUrl={campaignApiUrl}
            integrationSettings={integrationSettings}
            setIntegrationSettings={setIntegrationSettings}
          />
        )}
        {activeTab === "evaluation" && (
          <Evaluation
            activeCampaignId={activeCampaignId}
            authHeaders={authHeaders}
            benchmarkIdeas={benchmarkIdeas}
            campaignApiUrl={campaignApiUrl}
            campaigns={campaignRecords}
            setActiveCampaignId={setActiveCampaignId}
          />
        )}
        {activeTab === "settings" && <SettingsPanel activeCampaign={activeCampaign} senderProfiles={senderProfiles} setSenderProfiles={setSenderProfiles} />}
      </main>

      {selectedEvent && (
        <EventDrawer
          event={selectedEvent.event}
          campaign={selectedEvent.campaign}
          scheduleItem={schedule[eventKey(selectedEvent.campaign, selectedEvent.event)]}
          updateEventStatus={updateEventStatus}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

function CloudCampLogo({ className = "" }) {
  return (
    <div className={`cloudcamp-logo ${className}`.trim()} aria-label="CloudCamp logo" role="img">
      <span className="cloudcamp-logo-cloud" />
      <span className="cloudcamp-logo-path" />
    </div>
  );
}

function AuthGate({ onSignIn }) {
  return (
    <main className="auth-gate">
      <section className="auth-panel">
        <CloudCampLogo className="auth-cloudcamp-logo" />
        <img className="auth-logo" src="https://cloudwrxs.com/wp-content/themes/cloudwrxs/assets/images/logo-white.svg" alt="Cloudwrxs" />
        <p className="eyebrow">Cloudwrxs restricted access</p>
        <h1>CloudCamp</h1>
        <p>Sign in with your Cloudwrxs Google Workspace account to manage campaigns, emails, sender profiles, and results.</p>
        <button className="primary-button auth-button" onClick={onSignIn}>
          <PlugZap size={17} />
          Sign in with Google
        </button>
      </section>
    </main>
  );
}

function Dashboard({
  campaigns,
  visibleCampaigns,
  visible,
  toggleCampaign,
  activeCampaign,
  completion,
  month,
  moveEvent,
  schedule,
  setActiveCampaignId,
  totals,
  updateEventStatus,
  onSelectEvent
}) {
  const weekOneEvents = visibleCampaigns.flatMap((campaign) =>
    campaign.events
      .filter((event) => {
        const item = schedule[eventKey(campaign, event)];
        return item?.month === month && item.status !== "paused" && (item.weekIndex === 0 || item.weekIndex === 1);
      })
      .slice(0, 12)
      .map((event) => ({ campaign, event }))
  );

  return (
    <div className="page-grid">
      <section className="metrics-row">
        <Metric title="Planned touches" value={totals.touchpoints} note="From markdown calendars" icon={CalendarDays} />
        <Metric title="Complete so far" value={`${completion.complete}/${completion.total}`} note={`${completion.paused} paused or deferred`} icon={CheckCircle2} />
        <Metric title="Contacts in play" value={totals.contacts.toLocaleString()} note="HubSpot segment placeholder" icon={Target} />
        <Metric title="Pipeline target" value={currency(totals.pipeline)} note="Forecast placeholder" icon={TrendingUp} />
      </section>

      <section className="workspace">
        <div className="section-head">
          <div>
            <p className="eyebrow">Overlaid cycle</p>
            <h2>{month} activity map</h2>
          </div>
          <div className="legend">
            {Object.entries(channelMeta)
              .slice(0, 4)
              .map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <span key={key}>
                    <Icon size={14} />
                    {meta.label}
                  </span>
                );
              })}
          </div>
        </div>
        <CalendarOverlay
          activeCampaign={activeCampaign}
          campaigns={campaigns}
          month={month}
          moveEvent={moveEvent}
          schedule={schedule}
          setActiveCampaignId={setActiveCampaignId}
          visible={visible}
          onSelectEvent={onSelectEvent}
        />
      </section>

      <aside className="right-rail">
        <CompletionPanel campaigns={campaigns} schedule={schedule} updateEventStatus={updateEventStatus} />
        <AutomationPanel />
        <div className="panel">
          <div className="panel-head">
            <h3>Visible campaigns</h3>
            <Filter size={16} />
          </div>
          <div className="campaign-filter">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                className={visible.has(campaign.id) ? "enabled" : ""}
                onClick={() => toggleCampaign(campaign.id)}
                style={{ "--campaign": campaign.color, "--campaign-bg": campaign.bg }}
              >
                <span className="swatch" />
                <span>{campaign.shortName}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>This week</h3>
            <BarChart3 size={16} />
          </div>
          <div className="activity-list">
            {weekOneEvents.slice(0, 9).map(({ campaign, event }) => (
              <ActivityRow key={`${campaign.id}-${event.id}`} campaign={campaign} event={event} onClick={() => onSelectEvent({ campaign, event })} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Metric({ title, value, note, icon: Icon }) {
  return (
    <div className="metric">
      <Icon size={18} />
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function CalendarOverlay({ campaigns, activeCampaign, month, moveEvent, schedule, setActiveCampaignId, visible, onSelectEvent }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeks = getMonthWeeks(month);
  const [draggingKey, setDraggingKey] = useState(null);
  const draggingCampaignId = draggingKey?.split(":")[0];
  const draggingCampaign = campaigns.find((campaign) => campaign.id === draggingCampaignId);
  const flowPoints = draggingCampaignId
    ? draggingCampaign
        ?.events.map((event) => ({ event, position: schedule[eventKey(draggingCampaign, event)] }))
        .filter(({ event, position }) => position?.month === month && position.status !== "paused" && calendarTypes.has(event.type))
        .sort((a, b) => a.position.weekIndex - b.position.weekIndex || a.position.dayIndex - b.position.dayIndex)
        .map(({ position }) => {
          const slotIndex = campaigns.findIndex((campaign) => campaign.id === draggingCampaignId);
          const slotColumn = slotIndex % 3;
          const slotRow = Math.floor(slotIndex / 3);
          return {
            x: ((position.dayIndex + (slotColumn + 0.5) / 3) / 7) * 100,
            y: ((position.weekIndex + (slotRow + 0.5) / 2) / weeks.length) * 100
          };
        }) || []
    : [];
  const flowPath = buildFlowPath(flowPoints);

  return (
    <div className="calendar-board">
      <div className="calendar-head">
        <span />
        {days.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-flow-area" aria-hidden="true">
        {flowPoints.length > 1 && (
          <svg className="flow-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d={flowPath} />
          </svg>
        )}
      </div>
      {weeks.map((week, weekIndex) => (
        <div className="calendar-row" key={week.label}>
          <div className="week-label">
            <strong>{week.label}</strong>
            <span>{week.range}</span>
          </div>
          {days.map((day, dayIndex) => (
            <div
              className={`calendar-cell ${draggingKey ? "drop-ready" : ""} ${!week.days[dayIndex] ? "outside-month" : ""}`}
              key={`${week}-${day}`}
              onDragOver={(event) => {
                if (week.days[dayIndex]) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!week.days[dayIndex]) return;
                const key = event.dataTransfer.getData("text/plain") || draggingKey;
                if (key) moveEvent(key, { month, weekIndex, dayIndex });
                setDraggingKey(null);
              }}
            >
              <div className="slot-grid" />
              <div className="touch-grid">
                {campaigns.map((campaign, slotIndex) => {
                  if (!visible.has(campaign.id)) return <span key={campaign.id} />;
                  const event = campaign.events.find((item) => {
                    const position = schedule[eventKey(campaign, item)];
                    return (
                      position?.month === month &&
                      position.weekIndex === weekIndex &&
                      position.dayIndex === dayIndex &&
                      position.status !== "paused" &&
                      calendarTypes.has(item.type)
                    );
                  });
                  if (!event || slotIndex > 5) return <span key={campaign.id} />;
                  const key = eventKey(campaign, event);
                  const position = schedule[key];
                  const timingState = activityTimingState(position);
                  const meta = channelMeta[event.type] || channelMeta.task;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={campaign.id}
                      draggable
                      className={`touch ${meta.className} ${position?.status || "queued"} ${timingState} ${activeCampaign?.id === campaign.id ? "active" : ""} ${
                        draggingCampaignId && draggingCampaignId !== campaign.id ? "flow-dimmed" : ""
                      } ${draggingCampaignId === campaign.id ? "flow-focus" : ""}`}
                      title={`${campaign.shortName}: ${event.title}`}
                      style={{ "--campaign": campaign.color, "--campaign-bg": campaign.bg, "--campaign-text": campaign.textColor }}
                      onDragStart={(dragEvent) => {
                        dragEvent.dataTransfer.setData("text/plain", key);
                        setDraggingKey(key);
                      }}
                      onDragEnd={() => setDraggingKey(null)}
                      onMouseDown={() => setDraggingKey(key)}
                      onMouseUp={() => setDraggingKey(null)}
                      onClick={() => {
                        setActiveCampaignId(campaign.id);
                        onSelectEvent({ campaign, event });
                      }}
                    >
                      <Icon size={15} />
                      <span>{eventDisplayNumber(campaign, event)}</span>
                    </button>
                  );
                })}
              </div>
              <span className="date-chip">{week.days[dayIndex]}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function activityTimingState(item = {}) {
  if (!item || ["complete", "paused"].includes(item.status)) return "";
  const activityDate = dateFromPosition(item);
  if (!activityDate) return "";
  const days = dayDiff(new Date(), activityDate);
  if (days < 0) return "late";
  if (days === 0) return "due-today";
  if (days <= 5) return "upcoming";
  return "scheduled";
}

function activityTimingLabel(item = {}) {
  const state = activityTimingState(item);
  if (state === "late") return "Late";
  if (state === "due-today") return "Due today";
  if (state === "upcoming") return "Upcoming";
  if (state === "scheduled") return "Scheduled";
  if (item?.status === "complete") return "Complete";
  if (item?.status === "paused") return "Paused";
  return "No date";
}

function sendRunStatusLabel(status = "") {
  if (status === "review_required") return "Review required";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "sending") return "Sending";
  if (status === "partially_sent") return "Partially sent";
  if (status === "sent_with_failures") return "Sent with failures";
  if (status === "sent") return "Sent";
  return status || "Unknown";
}

function buildFlowPath(points) {
  if (points.length < 2) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const wrapsToNextRow = point.y > previous.y && point.x <= previous.x;
    if (wrapsToNextRow) {
      const betweenRowsY = previous.y + (point.y - previous.y) * 0.5;
      const loopRightX = Math.min(99, Math.max(previous.x, point.x) + 8);
      const loopLeftX = Math.max(1, Math.min(previous.x, point.x) - 8);
      const beforeTileX = Math.max(1.5, point.x - 5);
      return [
        path,
        `C ${previous.x + 5} ${previous.y}, ${loopRightX - 2} ${previous.y}, ${loopRightX} ${previous.y}`,
        `C ${loopRightX + 4} ${previous.y}, ${loopRightX + 4} ${betweenRowsY}, ${loopRightX} ${betweenRowsY}`,
        `C ${loopRightX - 10} ${betweenRowsY}, ${loopLeftX + 10} ${betweenRowsY}, ${loopLeftX} ${betweenRowsY}`,
        `C ${loopLeftX - 4} ${betweenRowsY}, ${loopLeftX - 4} ${point.y}, ${beforeTileX} ${point.y}`,
        `C ${beforeTileX + 2} ${point.y}, ${point.x - 2} ${point.y}, ${point.x} ${point.y}`
      ].join(" ");
    }
    const distance = Math.max(7, Math.abs(point.x - previous.x) * 0.48);
    const c1x = previous.x + distance;
    const c2x = Math.max(previous.x + 2, point.x - distance);
    return `${path} C ${c1x} ${previous.y}, ${c2x} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function CompletionPanel({ campaigns, schedule, updateEventStatus }) {
  const rows = campaigns
    .flatMap((campaign) => campaign.events.map((event) => ({ campaign, event, item: schedule[eventKey(campaign, event)] })))
    .filter(({ item }) => item?.status === "wip" || item?.status === "active" || item?.status === "paused")
    .slice(0, 6);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Completion control</h3>
        <CheckCircle2 size={16} />
      </div>
      <div className="status-stack">
        {rows.map(({ campaign, event, item }) => (
          <div className="status-row" key={eventKey(campaign, event)}>
            <span className={`status-dot ${item.status}`} />
            <div>
              <strong>{event.label || channelMeta[event.type]?.label}</strong>
              <small>{campaign.shortName} · {item.month} · W{item.weekIndex + 1}</small>
            </div>
            <select value={item.status === "active" ? "wip" : item.status} onChange={(changeEvent) => updateEventStatus(eventKey(campaign, event), changeEvent.target.value)}>
              {workflowStatuses.map((status) => (
                <option key={status.id} value={status.id}>{status.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationPanel() {
  return (
    <div className="panel automation-panel">
      <div className="panel-head">
        <h3>Automation model</h3>
        <RotateCcw size={16} />
      </div>
      <div className="automation-flow">
        <span>Define</span>
        <span>Approve</span>
        <span>Schedule</span>
        <span>Send</span>
        <span>Measure</span>
      </div>
      <p>After setup, campaign actions should run from the calendar with pause, defer, approval, and result-sync controls.</p>
    </div>
  );
}

function ActivityRow({ campaign, event, onClick }) {
  const meta = channelMeta[event.type] || channelMeta.task;
  const Icon = meta.icon;
  return (
    <button className="activity-row" onClick={onClick}>
      <span className={`activity-icon ${meta.className}`}>
        <Icon size={14} />
      </span>
      <span>
        <strong>{event.label || meta.label}</strong>
        <small>{campaign.shortName} · {event.week}</small>
      </span>
      <em>{event.title}</em>
    </button>
  );
}

function CampaignComponentRow({ campaign, event, scheduleItem, onSelectEvent, updateEventStatus }) {
  const meta = channelMeta[event.type] || channelMeta.task;
  const Icon = meta.icon;
  const key = eventKey(campaign, event);
  const status = scheduleItem?.status || "queued";
  const eventDate = dateFromPosition(scheduleItem || {});

  return (
    <div className="campaign-component-row">
      <button className="campaign-component-main" onClick={() => onSelectEvent({ campaign, event })}>
        <span className={`activity-icon ${meta.className}`}>
          <Icon size={14} />
        </span>
        <span>
          <strong>{event.label || meta.label}</strong>
          <small>{eventDate ? dateToInputValue(eventDate) : event.week}</small>
        </span>
        <em>{event.title}</em>
      </button>
      <select className={`component-status-select ${status}`} value={status === "active" ? "wip" : status} onChange={(event) => updateEventStatus(key, event.target.value)}>
        {workflowStatuses.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function Campaigns({
  activeCampaignId,
  addCampaignEvent,
  activityFeedback,
  campaigns,
  changeCampaignStartDate,
  deleteCampaignEvent,
  duplicateCampaignEvent,
  moveCampaignEvent,
  onSelectEvent,
  revertCampaign,
  schedule,
  setActiveCampaignId,
  updateCampaign,
  updateCampaignEvent,
  updateCampaignEventDate,
  updateCampaignMetric,
  updateEventStatus
}) {
  const selectedCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) || campaigns[0];

  if (!campaigns.length) {
    return (
      <section className="panel email-empty-state">
        <p className="eyebrow">Campaign filter</p>
        <h2>No campaigns match this status filter</h2>
        <p>Select another status combination from the top bar to bring campaigns back into view.</p>
      </section>
    );
  }

  return (
    <div className="campaign-editor-layout">
      <div className="campaign-grid campaign-picker-grid">
        {campaigns.map((campaign) => {
          const campaignStart = getCampaignStartDate(campaign, schedule);
          return (
            <article
              className={`campaign-card selectable ${campaign.id === selectedCampaign?.id ? "selected" : ""}`}
              key={campaign.id}
              style={{ "--campaign": campaign.color, "--campaign-bg": campaign.bg }}
              onClick={() => setActiveCampaignId(campaign.id)}
            >
              <div className="campaign-card-top">
                <span className="swatch large" />
                <div>
                  <p className="eyebrow">{campaign.budget} · {campaign.folder}</p>
                  <h2>{campaign.name}</h2>
                </div>
              </div>
              <p>{campaign.objective}</p>
              <div className="campaign-date-control" onClick={(event) => event.stopPropagation()}>
                <label>
                  <span>Campaign start date</span>
                  <input type="date" value={dateToInputValue(campaignStart)} onChange={(event) => changeCampaignStartDate(campaign, event.target.value)} />
                </label>
                <small>Changing this shifts every scheduled component by the same number of days.</small>
              </div>
              <div className="mini-metrics">
                <span>{campaign.metrics.plannedTouchpoints} touches</span>
                <span>{campaign.metrics.linkedin} LinkedIn</span>
                <span>{campaign.files.length} source files</span>
              </div>
              <div className="persona-cloud">
                {campaign.personas.slice(0, 5).map((persona) => (
                  <span key={persona}>{persona}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {selectedCampaign && (
        <CampaignEditor
          addCampaignEvent={addCampaignEvent}
          activityFeedback={activityFeedback}
          campaign={selectedCampaign}
          changeCampaignStartDate={changeCampaignStartDate}
          deleteCampaignEvent={deleteCampaignEvent}
          duplicateCampaignEvent={duplicateCampaignEvent}
          moveCampaignEvent={moveCampaignEvent}
          onSelectEvent={onSelectEvent}
          revertCampaign={revertCampaign}
          schedule={schedule}
          updateCampaign={updateCampaign}
          updateCampaignEvent={updateCampaignEvent}
          updateCampaignEventDate={updateCampaignEventDate}
          updateCampaignMetric={updateCampaignMetric}
          updateEventStatus={updateEventStatus}
        />
      )}
    </div>
  );
}

function CampaignEditor({
  addCampaignEvent,
  activityFeedback,
  campaign,
  changeCampaignStartDate,
  deleteCampaignEvent,
  duplicateCampaignEvent,
  moveCampaignEvent,
  onSelectEvent,
  revertCampaign,
  schedule,
  updateCampaign,
  updateCampaignEvent,
  updateCampaignEventDate,
  updateCampaignMetric,
  updateEventStatus
}) {
  const campaignStart = getCampaignStartDate(campaign, schedule);

  function updatePersonas(value) {
    updateCampaign(
      campaign.id,
      "personas",
      value
        .split(",")
        .map((persona) => persona.trim())
        .filter(Boolean)
    );
  }

  return (
    <section className="panel campaign-editor-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Selected campaign</p>
          <h2>{campaign.shortName}</h2>
        </div>
        <div className="editor-actions">
          <button className="icon-button compact" title="Revert campaign" onClick={() => revertCampaign(campaign)}>
            <RotateCcw size={15} />
          </button>
          <button className="primary-button compact" onClick={() => addCampaignEvent(campaign)}>
            <Plus size={15} />
            Add activity
          </button>
        </div>
      </div>

      <div className="campaign-edit-form">
        <label className="wide-field">
          <span>Campaign name</span>
          <input value={campaign.name || ""} onChange={(event) => updateCampaign(campaign.id, "name", event.target.value)} />
        </label>
        <label>
          <span>Short name</span>
          <input value={campaign.shortName || ""} onChange={(event) => updateCampaign(campaign.id, "shortName", event.target.value)} />
        </label>
        <label>
          <span>Budget</span>
          <input value={campaign.budget || ""} onChange={(event) => updateCampaign(campaign.id, "budget", event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={campaign.status || "active"} onChange={(event) => updateCampaign(campaign.id, "status", event.target.value)}>
            <option value="queued">Queued</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="complete">Complete</option>
          </select>
        </label>
        <label>
          <span>Campaign start date</span>
          <input type="date" value={dateToInputValue(campaignStart)} onChange={(event) => changeCampaignStartDate(campaign, event.target.value)} />
        </label>
        <label className="wide-field">
          <span>Objective</span>
          <textarea value={campaign.objective || ""} onChange={(event) => updateCampaign(campaign.id, "objective", event.target.value)} />
        </label>
        <label className="wide-field">
          <span>Personas</span>
          <input value={(campaign.personas || []).join(", ")} onChange={(event) => updatePersonas(event.target.value)} />
        </label>
        <label>
          <span>Planned touches</span>
          <input type="number" value={campaign.metrics?.plannedTouchpoints || 0} onChange={(event) => updateCampaignMetric(campaign.id, "plannedTouchpoints", event.target.value)} />
        </label>
        <label>
          <span>Contacts</span>
          <input type="number" value={campaign.metrics?.plannedContacts || 0} onChange={(event) => updateCampaignMetric(campaign.id, "plannedContacts", event.target.value)} />
        </label>
        <label>
          <span>Meetings</span>
          <input type="number" value={campaign.metrics?.meetings || 0} onChange={(event) => updateCampaignMetric(campaign.id, "meetings", event.target.value)} />
        </label>
        <label>
          <span>Pipeline</span>
          <input type="number" value={campaign.metrics?.pipeline || 0} onChange={(event) => updateCampaignMetric(campaign.id, "pipeline", event.target.value)} />
        </label>
      </div>

      <div className="campaign-activity-editor">
        <div className="panel-head">
          <h3>Campaign components</h3>
          <span>{campaign.events.length} activities</span>
        </div>
        {campaign.events.map((event, index) => (
          <CampaignActivityEditorRow
            key={event.id}
            campaign={campaign}
            deleteCampaignEvent={deleteCampaignEvent}
            duplicateCampaignEvent={duplicateCampaignEvent}
            event={event}
            feedbackEffect={activityFeedback[eventKey(campaign, event)] || ""}
            isFirst={index === 0}
            isLast={index === campaign.events.length - 1}
            moveCampaignEvent={moveCampaignEvent}
            onSelectEvent={onSelectEvent}
            scheduleItem={schedule[eventKey(campaign, event)]}
            updateCampaignEvent={updateCampaignEvent}
            updateCampaignEventDate={updateCampaignEventDate}
            updateEventStatus={updateEventStatus}
          />
        ))}
      </div>
    </section>
  );
}

function CampaignActivityEditorRow({
  campaign,
  deleteCampaignEvent,
  duplicateCampaignEvent,
  event,
  feedbackEffect,
  isFirst,
  isLast,
  moveCampaignEvent,
  onSelectEvent,
  scheduleItem,
  updateCampaignEvent,
  updateCampaignEventDate,
  updateEventStatus
}) {
  const meta = channelMeta[event.type] || channelMeta.task;
  const Icon = meta.icon;
  const key = eventKey(campaign, event);
  const status = scheduleItem?.status || "queued";
  const eventDate = dateFromPosition(scheduleItem || {});

  return (
    <article className={`campaign-activity-edit-row ${feedbackEffect ? `feedback-active ${feedbackEffect}` : ""}`}>
      <div className="activity-edit-actions">
        <button className={`activity-icon ${meta.className}`} title="View activity details" onClick={() => onSelectEvent({ campaign, event })}>
          <Icon size={15} />
        </button>
        <button className="icon-button compact" title="Move up" disabled={isFirst} onClick={() => moveCampaignEvent(campaign, event, -1)}>
          <ChevronUp size={14} />
        </button>
        <button className="icon-button compact" title="Move down" disabled={isLast} onClick={() => moveCampaignEvent(campaign, event, 1)}>
          <ChevronDown size={14} />
        </button>
        <button className="icon-button compact" title="Duplicate activity" onClick={() => duplicateCampaignEvent(campaign, event)}>
          <Copy size={14} />
        </button>
        <button className="icon-button compact danger" title="Delete activity" onClick={() => deleteCampaignEvent(campaign, event)}>
          <Trash2 size={14} />
        </button>
      </div>
      <label>
        <span>Type</span>
        <select value={event.type} onChange={(changeEvent) => updateCampaignEvent(campaign, event, "type", changeEvent.target.value)}>
          {Object.entries(channelMeta).map(([type, item]) => (
            <option key={type} value={type}>{item.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Label</span>
        <input value={event.label || ""} onChange={(changeEvent) => updateCampaignEvent(campaign, event, "label", changeEvent.target.value)} />
      </label>
      <label className="date-field">
        <span>Date</span>
        <input type="date" value={eventDate ? dateToInputValue(eventDate) : ""} onChange={(changeEvent) => updateCampaignEventDate(campaign, event, changeEvent.target.value)} />
      </label>
      <label>
        <span>Status</span>
        <select className={`component-status-select ${status}`} value={status === "active" ? "wip" : status} onChange={(changeEvent) => updateEventStatus(key, changeEvent.target.value)}>
          {workflowStatuses.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="wide-field">
        <span>Title</span>
        <input value={event.title || ""} onChange={(changeEvent) => updateCampaignEvent(campaign, event, "title", changeEvent.target.value)} />
      </label>
      <label className="wide-field">
        <span>Section</span>
        <input value={event.section || ""} onChange={(changeEvent) => updateCampaignEvent(campaign, event, "section", changeEvent.target.value)} />
      </label>
    </article>
  );
}

function emailKey(email = "") {
  return String(email).trim().toLowerCase();
}

function buildComplianceIndex(unsubscribers = [], emailEvents = []) {
  const index = {};
  unsubscribers.forEach((item) => {
    const email = emailKey(item.email || item.recipient);
    if (!email) return;
    index[email] = { suppressed: true, reason: "unsubscribed" };
  });
  emailEvents.forEach((item) => {
    const email = emailKey(item.recipient || item.email);
    if (!email) return;
    if (String(item.eventType || "").toLowerCase() === "bounce") {
      if (index[email]?.reason !== "unsubscribed") index[email] = { suppressed: true, reason: "bounced" };
    }
    if (String(item.eventType || "").toLowerCase() === "complaint") {
      index[email] = { suppressed: true, reason: "complaint" };
    }
  });
  return index;
}

function buildEngagementIndex(contactEngagement = [], emailEvents = []) {
  const index = {};
  [...contactEngagement, ...emailEvents].forEach((item) => {
    const email = emailKey(item.email || item.recipient);
    if (!email) return;
    const eventType = String(item.eventType || item.type || "").toLowerCase();
    index[email] = index[email] || { opens: 0, clicks: 0, bounces: 0 };
    if (eventType === "open") index[email].opens += Number(item.count || 1);
    if (eventType === "click") index[email].clicks += Number(item.count || 1);
    if (eventType === "bounce") index[email].bounces += Number(item.count || 1);
  });
  return index;
}

function applyAudienceFilters(contacts, filters, compliance, context = {}) {
  const activeFilters = filters.filter((filter) => filter.operator === "in" ? filterValueList(filter).length : filter.value);
  return contacts.filter((contact) =>
    activeFilters.every((filter) => {
      if (filter.field === "audienceExclusion") return !context.audienceExclusionEmails?.has(emailKey(contact.email));
      const actual = String(audienceFilterActualValue(contact, filter.field, compliance)).toLowerCase();
      const expected = String(filter.value || "").toLowerCase();
      if (filter.operator === "contains") return actual.includes(expected);
      if (filter.operator === "in") return filterValueList(filter).map((item) => item.toLowerCase()).includes(actual);
      if (filter.operator === "not_equals") return actual !== expected;
      return actual === expected;
    })
  );
}

function emailDomain(email = "") {
  const domain = String(email || "").trim().toLowerCase().split("@")[1] || "";
  return domain.replace(/^www\./, "");
}

function audienceFilterActualValue(contact, field, compliance = {}) {
  if (field === "emailStatus") return compliance[emailKey(contact.email)]?.reason || "sendable";
  if (field === "emailDomain") return emailDomain(contact.email);
  return contact[field] || "";
}

function filterValueList(filter = {}) {
  const values = Array.isArray(filter.values)
    ? filter.values
    : String(filter.value || "").split(",");
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

function audienceListLabel(audienceLists, listId) {
  return audienceLists.find((list) => list.listId === listId)?.name || listId;
}

function buildAudienceExclusionEmails(filters = [], audienceLists = [], audienceContacts = [], compliance = {}) {
  const excludedListIds = filters
    .filter((filter) => filter.field === "audienceExclusion")
    .flatMap(filterValueList);
  if (!excludedListIds.length) return new Set();

  const emails = new Set();
  excludedListIds.forEach((listId) => {
    const list = audienceLists.find((item) => item.listId === listId);
    if (!list?.sourceListId) return;
    const contacts = audienceContacts.filter((contact) => contact.listId === list.sourceListId);
    const blockedIds = new Set(list.excludedContactIds || []);
    const frozenIds = new Set(list.frozenContactIds || []);
    const nestedFilters = (list.filters || []).filter((filter) => filter.field !== "audienceExclusion");
    const matched = list.frozen
      ? contacts.filter((contact) => frozenIds.has(contact.contactId))
      : applyAudienceFilters(contacts, nestedFilters, compliance);
    matched
      .filter((contact) => !blockedIds.has(contact.contactId))
      .forEach((contact) => {
        const key = emailKey(contact.email);
        if (key) emails.add(key);
      });
  });
  return emails;
}

function parseCsvRows(text = "") {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizeColumnName(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const sheetColumnAliases = {
  firstName: ["firstname", "first", "givenname"],
  lastName: ["lastname", "surname", "familyname"],
  fullName: ["name", "fullname", "contactname"],
  email: ["email", "emailaddress", "workemail", "businessemail", "email2", "email3"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "telephone"],
  country: ["country", "location", "region"],
  technology: ["technology", "technologies", "tech", "interest", "solution"],
  persona: ["persona", "audience", "segment"],
  jobTitle: ["jobtitle", "title", "role", "position"],
  lifecycleStage: ["lifecyclestage", "stage", "status", "leadstage"],
  company: ["company", "companyname", "account", "organisation", "organization"],
  owner: ["owner", "salesowner", "accountowner", "assignedto"]
};

function inferSheetColumnMap(headers = []) {
  const normalized = headers.map(normalizeColumnName);
  return Object.fromEntries(
    Object.entries(sheetColumnAliases).map(([field, aliases]) => [
      field,
      aliases.flatMap((alias) => normalized.map((header, index) => header === alias ? index : -1).filter((index) => index >= 0))
    ]).filter(([, indexes]) => indexes.length)
  );
}

function rowsToSheetContacts({ columnMap: providedColumnMap, rows, listId, sheetId, tabName, importRunId }) {
  const [headers = [], ...dataRows] = rows;
  const columnMap = providedColumnMap || inferSheetColumnMap(headers);
  return dataRows
    .map((row, index) => {
      const cell = (field) => firstNonEmptyCell(row, columnMap[field]);
      const fullName = cell("fullName");
      const [fallbackFirstName = "", ...fallbackLastName] = fullName.trim().split(/\s+/);
      const rawJobTitle = cell("jobTitle");
      const countryFromTitle = extractCountryFromText(rawJobTitle);
      return {
        listId,
        contactId: `sheet-${sheetId}-${tabName}-${importRunId}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
        firstName: cell("firstName") || fallbackFirstName,
        lastName: cell("lastName") || fallbackLastName.join(" "),
        email: cell("email").toLowerCase(),
        phone: cell("phone"),
        country: cell("country") || countryFromTitle,
        technology: cell("technology"),
        persona: cell("persona"),
        jobTitle: cleanJobTitle(rawJobTitle, countryFromTitle),
        lifecycleStage: cell("lifecycleStage"),
        company: cell("company"),
        owner: cell("owner"),
        sourceSheetId: sheetId,
        sourceSheetTabName: tabName
      };
    })
    .filter((contact) => contact.email && contact.email.includes("@"));
}

function firstNonEmptyCell(row, indexes = []) {
  for (const index of indexes) {
    const value = String(row[index] || "").trim();
    if (value) return value;
  }
  return "";
}

const countryNames = [
  "Saudi Arabia",
  "United Arab Emirates",
  "UAE",
  "Qatar",
  "Bahrain",
  "Kuwait",
  "Oman",
  "Egypt",
  "Jordan",
  "Lebanon",
  "India",
  "Pakistan",
  "United Kingdom",
  "United States"
];

function extractCountryFromText(value = "") {
  const lines = String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || "";
  const match = countryNames.find((country) => country.toLowerCase() === lastLine.toLowerCase());
  return match === "UAE" ? "United Arab Emirates" : match || "";
}

function cleanJobTitle(value = "", extractedCountry = "") {
  if (!extractedCountry) return value;
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.toLowerCase() !== extractedCountry.toLowerCase())
    .join(" ");
}

function quickPickValues(contacts, field) {
  return Array.from(new Set(contacts.map((contact) => field === "emailDomain" ? emailDomain(contact.email) : contact[field]).filter(Boolean).flatMap((value) => String(value).split(",").map((item) => item.trim()).filter(Boolean))))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 50);
}

function phoneDialCode(phone = "") {
  return String(phone).match(/^\+\d{1,4}/)?.[0] || "";
}

function normalizePersonaFilter(value = "ALL") {
  const normalized = String(value || "").trim();
  if (!normalized || ["ALL", "All", "All personas"].includes(normalized)) return "ALL";
  if (["<NONE>", "__NONE__", "NONE", "None", "No persona"].includes(normalized)) return "__NONE__";
  return normalized;
}

function personaFilterLabel(value = "ALL") {
  const filter = normalizePersonaFilter(value);
  if (filter === "ALL") return "ALL";
  if (filter === "__NONE__") return "UNSET";
  return filter;
}

function sortAudienceContacts(contacts, sortBy, engagement) {
  return [...contacts].sort((a, b) => {
    if (sortBy === "opens") return (engagement[emailKey(b.email)]?.opens || 0) - (engagement[emailKey(a.email)]?.opens || 0);
    if (sortBy === "clicks") return (engagement[emailKey(b.email)]?.clicks || 0) - (engagement[emailKey(a.email)]?.clicks || 0);
    if (sortBy === "dialCode") return phoneDialCode(a.phone).localeCompare(phoneDialCode(b.phone)) || String(a.phone || "").localeCompare(String(b.phone || ""));
    if (sortBy === "domain") return emailDomain(a.email).localeCompare(emailDomain(b.email)) || String(a.email || "").localeCompare(String(b.email || ""));
    if (sortBy === "company") return String(a.company || "").localeCompare(String(b.company || ""));
    return `${a.lastName || ""} ${a.firstName || ""}`.localeCompare(`${b.lastName || ""} ${b.firstName || ""}`);
  });
}

function formatSheetMappingMode(mode = "") {
  return {
    bedrock: "Bedrock AI",
    cached: "Saved",
    rules: "Rules",
    rules_fallback: "Rules fallback"
  }[mode] || mode;
}

function missingCompanyCoverage(contacts, compliance) {
  const companies = new Map();
  contacts.forEach((contact) => {
    const company = contact.company || "Unknown company";
    const entry = companies.get(company) || { company, blocked: 0, sendable: 0, reasons: new Set() };
    const status = compliance[emailKey(contact.email)];
    if (status?.suppressed) {
      entry.blocked += 1;
      entry.reasons.add(status.reason);
    } else {
      entry.sendable += 1;
    }
    companies.set(company, entry);
  });
  return Array.from(companies.values())
    .filter((entry) => entry.blocked > 0 && entry.sendable === 0)
    .map((entry) => ({ ...entry, reasons: Array.from(entry.reasons).join(", ") }));
}

function justCallUrl(phone = "", metadata = {}) {
  return justCallUrlWithMetadata(phone, metadata);
}

function justCallDesktopUrl(phone = "") {
  return `justcall://${normalizeDialPhone(phone)}`;
}

function justCallUrlWithMetadata(phone = "", metadata = {}) {
  const cleanPhone = normalizeDialPhone(phone);
  const params = new URLSearchParams({ numbers: cleanPhone });
  if (Object.keys(metadata || {}).length) {
    params.set("medium", "custom");
    params.set("metadata", JSON.stringify(metadata));
    params.set("metadata_type", "json");
  }
  return `https://app.justcall.io/dialer?${params.toString()}`;
}

function normalizeDialPhone(phone = "") {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return "";
  const firstNumber = trimmed.split(/\s*\n\s*|,\s*|\/\s*/)[0] || trimmed;
  const cleaned = firstNumber.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function isLeadNurtureCallStep(event = {}) {
  const text = `${event.type || ""} ${event.title || ""} ${event.label || ""} ${event.section || ""}`.toLowerCase();
  return event.type === "call" || (event.type === "task" && text.includes("call")) || text.includes("callback");
}

function leadContactKey(contact = {}) {
  return `${contact.listId || ""}:${contact.contactId || ""}`;
}

function contactName(contact = {}) {
  return `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email || "Unnamed contact";
}

function leadCallEventId(contactId, campaignId, taskId) {
  return `lead-call-${slugify(campaignId)}-${slugify(taskId)}-${slugify(contactId)}`;
}

function leadCallRecord(records = [], contactId, campaignId, taskId) {
  if (!contactId || !campaignId || !taskId) return null;
  const eventId = leadCallEventId(contactId, campaignId, taskId);
  return records.find((record) => record.eventId === eventId) || null;
}

function optionLabel(options = [], value = "") {
  return options.find((option) => option.value === value)?.label || value;
}

function hubSpotContactRecordUrl(contact = {}, portalId = "") {
  const recordId = String(contact.hubspotRecordId || "").trim();
  const safePortalId = String(portalId || "").trim();
  if (!recordId || !safePortalId) return "";
  return `https://app.hubspot.com/contacts/${encodeURIComponent(safePortalId)}/record/0-1/${encodeURIComponent(recordId)}`;
}

function leadHubSpotSyncLabel(record) {
  if (!record) return "Ready";
  if (record.hubspotSyncStatus === "error") return `HubSpot sync failed: ${record.hubspotSyncError || "check the HubSpot integration"}`;
  if (record.hubspotTaskStatus === "error") return `HubSpot task sync failed: ${record.hubspotTaskError || "check the HubSpot integration"}`;
  if (record.hubspotSyncStatus === "syncing") return "Syncing note to HubSpot...";
  if (record.hubspotSyncStatus === "pending") return "HubSpot note sync queued...";
  if (record.hubspotTaskStatus === "pending") return "HubSpot task sync queued...";
  if (record.hubspotTaskStatus === "synced") return "HubSpot note and task synced";
  if (record.hubspotSyncStatus === "synced") return "HubSpot note synced";
  return "Ready";
}

function assignedOwnerIdForContact(contact, campaign, assignments = [], senderProfiles = []) {
  const campaignAssignments = assignments.filter((assignment) => assignment.campaignId === campaign?.id);
  const owners = Array.from(new Set(campaignAssignments.flatMap((assignment) =>
    Array.isArray(assignment.ownerIds) && assignment.ownerIds.length ? assignment.ownerIds : [assignment.owner]
  ).filter(Boolean)));
  if (!owners.length) return contact.owner || senderProfiles[0]?.ownerId || "";
  const seed = emailKey(contact.email) || contact.contactId || contactName(contact);
  return owners[stableHash(seed) % owners.length];
}

function stableHash(value = "") {
  return Array.from(String(value)).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 0);
}

function buildLeadNurtureRow({ campaign, callSteps, contact, contactEngagement, emailAssignments, ownerProfileById, senderProfiles }) {
  const ownerId = assignedOwnerIdForContact(contact, campaign, emailAssignments, senderProfiles);
  const stepRows = callSteps.map((step) => {
    const record = leadCallRecord(contactEngagement, contact.contactId, campaign?.id, step.event.id);
    return {
      step,
      record,
      ...leadStatusForStep(step.dueDate, record)
    };
  });
  const actionable = stepRows
    .filter((row) => !["complete", "skipped"].includes(row.statusId))
    .sort((a, b) => leadStatusSortValue(a.statusId, a.dueDate) - leadStatusSortValue(b.statusId, b.dueDate));
  const selected = actionable[0] || stepRows[0] || {};
  return {
    contact,
    dueDate: selected.dueDate || selected.step?.dueDate || null,
    ownerId,
    ownerName: ownerProfileById[ownerId]?.name || ownerId,
    record: selected.record || null,
    statusId: selected.statusId || "upcoming",
    statusLabel: selected.statusLabel || "No call step",
    step: selected.step || null
  };
}

function leadStatusForStep(dueDate, record) {
  if (record?.outcome && skippedCallOutcomes.has(record.outcome)) return { statusId: "skipped", statusLabel: record.outcome, dueDate };
  if (record?.outcome && completedCallOutcomes.has(record.outcome) && record.outcome !== "Callback requested") return { statusId: "complete", statusLabel: record.outcome, dueDate };
  if (record?.callbackAt) {
    const callbackDate = inputValueToDate(String(record.callbackAt).slice(0, 10));
    const callbackStatus = dateDueStatus(callbackDate);
    return {
      statusId: callbackStatus.statusId === "upcoming" ? "deferred" : callbackStatus.statusId,
      statusLabel: callbackStatus.statusId === "upcoming" ? `Callback ${formatDate(callbackDate)}` : callbackStatus.statusLabel,
      dueDate: callbackDate
    };
  }
  return dateDueStatus(dueDate);
}

function dateDueStatus(date) {
  if (!date) return { statusId: "upcoming", statusLabel: "No date" };
  const diff = dayDiff(new Date(), date);
  if (diff < 0) return { statusId: "late", statusLabel: `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} late` };
  if (diff === 0) return { statusId: "due_today", statusLabel: "Due today" };
  return { statusId: "upcoming", statusLabel: `Due in ${diff} day${diff === 1 ? "" : "s"}` };
}

function leadStatusSortValue(statusId, date) {
  const order = { late: 0, due_today: 1, deferred: 2, upcoming: 3, complete: 4, skipped: 5 };
  return (order[statusId] ?? 6) * 100000 + (date ? Math.max(0, dayDiff(new Date(2026, 0, 1), date)) : 99999);
}

function statusMatchesLeadFilter(row, filter) {
  const statusId = row?.statusId;
  if (filter === "all") return true;
  if (filter === "due_late") return statusId === "due_today" || statusId === "late";
  if (filter === "upcoming") {
    const diff = row?.dueDate ? dayDiff(new Date(), row.dueDate) : null;
    return ["upcoming", "deferred"].includes(statusId) && diff > 0 && diff <= leadUpcomingWindowDays;
  }
  return statusId === filter;
}

function formatDate(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toDatetimeLocalValue(value = "") {
  if (!value) return "";
  return String(value).slice(0, 16);
}

function formatDateTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function nextBusinessCallDatetime(baseDate) {
  const today = new Date();
  const baseline = baseDate && dayDiff(today, baseDate) >= 0 ? baseDate : today;
  const next = addDays(baseline, 1);
  next.setHours(9, 0, 0, 0);
  return `${dateToInputValue(next)}T09:00`;
}

function buildLnccPreview(campaign, row, record) {
  if (!campaign || !row?.step) return "Select a campaign call step to generate an LNCC marker.";
  return `LNCC: campaignId=${campaign.id}; taskId=${row.step.event.id}; contactId=${row.contact.contactId}; outcome=${record?.outcome || "pending"}`;
}

function AudienceWorkspace({
  authHeaders,
  audienceContacts,
  audienceContactCounts,
  audienceLists,
  campaignApiUrl,
  campaigns,
  contactEngagement,
  emailEvents,
  googleSheetSources,
  selectedAudienceListId,
  setAudienceContacts,
  setAudienceContactCounts,
  setAudienceLists,
  setDeletedAudienceContacts,
  setDeletedAudienceListIds,
  setGoogleSheetSources,
  setSelectedAudienceListId,
  unsubscribers
}) {
  const [audienceSortBy, setAudienceSortBy] = useState("name");
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [sheetDraft, setSheetDraft] = useState({ name: "", sheetUrl: "", sheetId: "", tabsText: "Contacts" });
  const [sheetImportStatus, setSheetImportStatus] = useState("");
  const [hubspotListOptions, setHubspotListOptions] = useState([]);
  const [hubspotListStatus, setHubspotListStatus] = useState("");
  const [contactLoadStatus, setContactLoadStatus] = useState("");
  const [contactPageIndex, setContactPageIndex] = useState(0);
  const [contactPageTokens, setContactPageTokens] = useState([""]);
  const [contactNextToken, setContactNextToken] = useState("");
  const [contactPageSize, setContactPageSize] = useState(100);
  const [contactPageListId, setContactPageListId] = useState("");
  const [audienceMatchCount, setAudienceMatchCount] = useState(null);
  const [audienceMatchStatus, setAudienceMatchStatus] = useState("");
  const [audienceCountRefreshKey, setAudienceCountRefreshKey] = useState(0);
  const [audienceFieldFacets, setAudienceFieldFacets] = useState({});
  const [deleteSourceDraft, setDeleteSourceDraft] = useState(null);
  const [deleteSourceConfirmText, setDeleteSourceConfirmText] = useState("");
  const [deleteSourceBusy, setDeleteSourceBusy] = useState(false);
  const [deleteSourceStatus, setDeleteSourceStatus] = useState("");
  const [bulkUpdateField, setBulkUpdateField] = useState("persona");
  const [bulkUpdateValue, setBulkUpdateValue] = useState("");
  const [bulkUpdateScope, setBulkUpdateScope] = useState("page");
  const [bulkUpdateBusy, setBulkUpdateBusy] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState("");
  const [dirtyContactFields, setDirtyContactFields] = useState({});
  const [syncingContactIds, setSyncingContactIds] = useState({});
  const [contactSyncStatus, setContactSyncStatus] = useState({});
  const [hubspotExportBusy, setHubspotExportBusy] = useState(false);
  const [hubspotExportStatus, setHubspotExportStatus] = useState("");
  const [audienceListsCollapsed, setAudienceListsCollapsed] = useState(false);
  const [audienceListCampaignFilters, setAudienceListCampaignFilters] = useState([]);
  const audienceSources = audienceLists.filter((list) => !list.sourceListId);
  const campaignAudienceLists = audienceLists.filter((list) => list.sourceListId);
  const visibleCampaignAudienceLists = campaignAudienceLists.filter((list) =>
    !audienceListCampaignFilters.length ||
    audienceListCampaignFilters.some((campaignId) => (list.associatedCampaignIds || []).includes(campaignId))
  );
  const [selectedSourceId, setSelectedSourceId] = useState(() => audienceSources.find((list) => list.listId === selectedAudienceListId)?.listId || audienceSources[0]?.listId);
  const [selectedCampaignAudienceId, setSelectedCampaignAudienceId] = useState(() =>
    campaignAudienceLists.find((list) => list.listId === selectedAudienceListId)?.listId || campaignAudienceLists[0]?.listId || ""
  );
  const selectedSource = audienceSources.find((list) => list.listId === selectedSourceId) || audienceSources[0];
  const selectedList = campaignAudienceLists.find((list) => list.listId === selectedCampaignAudienceId) || campaignAudienceLists[0];
  const selectedListSource = audienceSources.find((list) => list.listId === selectedList?.sourceListId) || selectedSource;
  const sourceContacts = audienceContacts.filter((contact) => contact.listId === selectedListSource?.listId);
  const compliance = buildComplianceIndex(unsubscribers, emailEvents);
  const engagement = buildEngagementIndex(contactEngagement, emailEvents);
  const excludedContactIds = new Set(selectedList?.excludedContactIds || []);
  const frozenContactIds = new Set(selectedList?.frozenContactIds || []);
  const audienceExclusionEmails = buildAudienceExclusionEmails(selectedList?.filters || [], campaignAudienceLists, audienceContacts, compliance);
  const dynamicAudienceContacts = applyAudienceFilters(sourceContacts, selectedList?.filters || [], compliance, { audienceExclusionEmails }).filter((contact) => !excludedContactIds.has(contact.contactId));
  const audienceContactsForList = selectedList?.frozen
    ? sourceContacts.filter((contact) => frozenContactIds.has(contact.contactId) && !excludedContactIds.has(contact.contactId))
    : dynamicAudienceContacts;
  const filteredContacts = sortAudienceContacts(selectedList ? audienceContactsForList : [], audienceSortBy, engagement);
  const missingCompanies = missingCompanyCoverage(filteredContacts, compliance);
  const selectedSourceCount = audienceContactCounts[selectedListSource?.listId] ?? sourceContacts.length;
  const contactResultCount = selectedList ? audienceMatchCount : selectedSourceCount;
  const pageStart = contactResultCount && filteredContacts.length ? contactPageIndex * contactPageSize + 1 : 0;
  const pageEnd = contactResultCount ? Math.min(contactPageIndex * contactPageSize + filteredContacts.length, contactResultCount) : filteredContacts.length;

  useEffect(() => {
    const selectedReusableList = campaignAudienceLists.find((list) => list.listId === selectedAudienceListId);
    if (selectedReusableList && selectedReusableList.listId !== selectedCampaignAudienceId) {
      setSelectedCampaignAudienceId(selectedReusableList.listId);
    }
  }, [selectedAudienceListId, selectedCampaignAudienceId, campaignAudienceLists.map((list) => list.listId).join("|")]);

  useEffect(() => {
    if (!campaignAudienceLists.length) {
      if (selectedCampaignAudienceId) setSelectedCampaignAudienceId("");
      return;
    }
    if (!campaignAudienceLists.some((list) => list.listId === selectedCampaignAudienceId)) {
      setSelectedCampaignAudienceId(campaignAudienceLists[0].listId);
    }
  }, [selectedCampaignAudienceId, campaignAudienceLists.map((list) => list.listId).join("|")]);

  useEffect(() => {
    const currentReusableList = campaignAudienceLists.find((list) => list.listId === selectedCampaignAudienceId);
    if (!currentReusableList) return;
    if (selectedAudienceListId !== currentReusableList.listId) setSelectedAudienceListId(currentReusableList.listId);
    if (currentReusableList.sourceListId && selectedSourceId !== currentReusableList.sourceListId) {
      setSelectedSourceId(currentReusableList.sourceListId);
    }
  }, [selectedCampaignAudienceId, selectedAudienceListId, selectedSourceId, campaignAudienceLists.map((list) => `${list.listId}:${list.sourceListId}`).join("|")]);

  useEffect(() => {
    if (!campaignApiUrl || selectedSource?.sourceType !== "hubspot" || !["segment", "company_segment"].includes(selectedSource.hubspotImportMode || "segment")) return;
    if (hubspotListOptions.length) return;
    let cancelled = false;
    fetchHubSpotListOptions("", { cancelled: () => cancelled, silent: true });
    return () => {
      cancelled = true;
    };
  }, [campaignApiUrl, selectedSource?.sourceType, selectedSource?.hubspotImportMode, selectedSource?.listId, authHeaders.Authorization]);

  useEffect(() => {
    if (!selectedListSource?.listId) return;
    (selectedList?.filters || [])
      .filter((filter) => filter.field && filter.field !== "audienceExclusion")
      .forEach((filter) => loadAudienceFieldFacet(filter.field));
  }, [selectedListSource?.listId, selectedList?.listId, JSON.stringify((selectedList?.filters || []).map((filter) => filter.field)), authHeaders.Authorization]);

  useEffect(() => {
    if (!campaignApiUrl || !selectedListSource?.listId) return;
    setContactPageIndex(0);
    setContactPageTokens([""]);
    setContactNextToken("");
    setContactPageListId(selectedListSource.listId);
    let cancelled = false;
    fetchAudienceContactsPage(selectedListSource.listId, { pageIndex: 0, pageToken: "", cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [
    campaignApiUrl,
    selectedListSource?.listId,
    selectedList?.listId,
    JSON.stringify(selectedList?.filters || []),
    JSON.stringify(selectedList?.excludedContactIds || []),
    JSON.stringify(selectedList?.frozenContactIds || []),
    selectedList?.frozen,
    contactPageSize,
    authHeaders.Authorization
  ]);

  useEffect(() => {
    if (!selectedList || !selectedListSource?.listId) {
      setAudienceMatchCount(null);
      setAudienceMatchStatus("");
      return;
    }
    if (!campaignApiUrl) {
      setAudienceMatchCount(filteredContacts.length);
      setAudienceMatchStatus("");
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setAudienceMatchStatus("Counting full audience...");
      try {
        const params = new URLSearchParams({
          audienceListId: selectedList.listId,
          countOnly: "true"
        });
        const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Audience count failed: ${response.status}`);
        if (cancelled) return;
        setAudienceMatchCount(result.count || 0);
        setAudienceMatchStatus("");
      } catch (error) {
        if (cancelled) return;
        setAudienceMatchCount(null);
        setAudienceMatchStatus(error.message);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    campaignApiUrl,
    selectedList?.listId,
    selectedListSource?.listId,
    JSON.stringify(selectedList?.filters || []),
    JSON.stringify(selectedList?.excludedContactIds || []),
    JSON.stringify(selectedList?.frozenContactIds || []),
    selectedList?.frozen,
    audienceCountRefreshKey,
    authHeaders.Authorization
  ]);

  async function fetchAudienceContactsPage(listId, { pageIndex = 0, pageToken = "", cancelled } = {}) {
    if (!campaignApiUrl || !listId) return;
    setContactLoadStatus("Loading audience contacts...");
    try {
      const params = new URLSearchParams({
        limit: String(contactPageSize),
        ...(selectedList?.listId ? { audienceListId: selectedList.listId } : { listId })
      });
      if (pageToken) params.set("nextToken", pageToken);
      const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Contact load failed: ${response.status}`);
      if (cancelled?.()) return;
      const contacts = result.contacts || [];
      setAudienceContacts((current) => [...current.filter((contact) => contact.listId !== listId), ...contacts]);
      setContactNextToken(result.nextToken || "");
      setContactPageIndex(pageIndex);
      setContactPageListId(listId);
      if (result.nextToken) {
        setContactPageTokens((current) => {
          const next = current.slice(0, pageIndex + 1);
          next[pageIndex + 1] = result.nextToken;
          return next;
        });
      }
      setContactLoadStatus(`Showing ${contacts.length.toLocaleString()} contacts on this page.`);
    } catch (error) {
      setContactLoadStatus(error.message);
    }
  }

  async function loadAudienceFieldFacet(field) {
    if (!campaignApiUrl || !selectedListSource?.listId || !field || field === "audienceExclusion") return;
    const key = `${selectedListSource.listId}:${field}`;
    const current = audienceFieldFacets[key];
    if (current?.loading || current?.loaded) return;
    setAudienceFieldFacets((state) => ({
      ...state,
      [key]: { loading: true, loaded: false, options: [] }
    }));
    try {
      const params = new URLSearchParams({
        facet: "field",
        field,
        listId: selectedListSource.listId
      });
      const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Audience facet failed: ${response.status}`);
      setAudienceFieldFacets((state) => ({
        ...state,
        [key]: {
          error: "",
          loaded: true,
          loading: false,
          options: result.options || [],
          total: result.total || 0
        }
      }));
    } catch (error) {
      setAudienceFieldFacets((state) => ({
        ...state,
        [key]: { error: error.message, loaded: false, loading: false, options: [] }
      }));
    }
  }

  function moveContactFirstPage() {
    if (!selectedListSource?.listId) return;
    setContactPageTokens([""]);
    fetchAudienceContactsPage(selectedListSource.listId, { pageIndex: 0, pageToken: "" });
  }

  function moveContactPage(direction) {
    if (!selectedListSource?.listId) return;
    const nextIndex = contactPageIndex + direction;
    if (nextIndex < 0) return;
    if (direction > 0 && !contactNextToken) return;
    const pageToken = direction > 0 ? contactNextToken : contactPageTokens[nextIndex] || "";
    fetchAudienceContactsPage(selectedListSource.listId, { pageIndex: nextIndex, pageToken });
  }

  async function moveContactLastPage() {
    if (!campaignApiUrl || !selectedListSource?.listId || !contactNextToken) return;
    const total = contactResultCount || selectedSourceCount || 0;
    const lastIndex = Math.max(0, Math.ceil(total / contactPageSize) - 1);
    setContactLoadStatus("Finding last page...");
    try {
      let pageToken = "";
      const tokens = [""];
      let result = null;
      for (let index = 0; index <= lastIndex; index += 1) {
        const params = new URLSearchParams({
          limit: String(contactPageSize),
          ...(selectedList?.listId ? { audienceListId: selectedList.listId } : { listId: selectedListSource.listId })
        });
        if (pageToken) params.set("nextToken", pageToken);
        const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
        result = await response.json();
        if (!response.ok) throw new Error(result.message || `Contact load failed: ${response.status}`);
        if (!result.nextToken || index === lastIndex) {
          const contacts = result.contacts || [];
          setAudienceContacts((current) => [...current.filter((contact) => contact.listId !== selectedListSource.listId), ...contacts]);
          setContactPageIndex(index);
          setContactNextToken(result.nextToken || "");
          setContactPageTokens(tokens);
          setContactLoadStatus(`Showing ${contacts.length.toLocaleString()} contacts on this page.`);
          return;
        }
        pageToken = result.nextToken;
        tokens[index + 1] = pageToken;
      }
    } catch (error) {
      setContactLoadStatus(error.message);
    }
  }

  async function runBulkContactUpdate() {
    if (!selectedList || !selectedListSource || !bulkUpdateField || !bulkUpdateValue.trim()) return;
    const value = bulkUpdateValue.trim();
    setBulkUpdateBusy(true);
    setBulkUpdateStatus("Preparing bulk update...");
    try {
      if (bulkUpdateScope === "page") {
        const contactIds = filteredContacts.map((contact) => contact.contactId);
        if (!contactIds.length) {
          setBulkUpdateStatus("No visible filtered contacts to update.");
          return;
        }
        const response = await fetch(`${campaignApiUrl}/audience-contacts`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            bulkUpdate: true,
            contactIds,
            contacts: filteredContacts,
            field: bulkUpdateField,
            listId: selectedListSource.listId,
            scope: "page",
            value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Bulk update failed: ${response.status}`);
        const updatedIds = new Set(contactIds);
        setAudienceContacts((current) =>
          current.map((contact) =>
            contact.listId === selectedListSource.listId && updatedIds.has(contact.contactId)
              ? { ...contact, [bulkUpdateField]: value, updatedAt: nowIso() }
              : contact
          )
        );
        setAudienceCountRefreshKey((current) => current + 1);
        setBulkUpdateStatus(`Updated ${result.updated.toLocaleString()} contacts on this page.`);
        return;
      }

      let nextToken = "";
      let totalUpdated = 0;
      let totalChecked = 0;
      let done = false;
      while (!done) {
        const response = await fetch(`${campaignApiUrl}/audience-contacts`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            bulkUpdate: true,
            excludedContactIds: selectedList.excludedContactIds || [],
            field: bulkUpdateField,
            filters: selectedList.frozen ? [] : selectedList.filters || [],
            frozenContactIds: selectedList.frozenContactIds || [],
            frozenOnly: selectedList.frozen ? "true" : "false",
            limit: 750,
            listId: selectedListSource.listId,
            nextToken,
            scope: "all",
            value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Bulk update failed: ${response.status}`);
        totalUpdated += result.updated || 0;
        totalChecked += result.checked || 0;
        done = result.done;
        nextToken = result.nextToken || "";
        setBulkUpdateStatus(`Updated ${totalUpdated.toLocaleString()} matching contacts after checking ${totalChecked.toLocaleString()} rows...`);
        if (!done) await sleep(150);
      }
      setContactPageTokens([""]);
      setContactNextToken("");
      await fetchAudienceContactsPage(selectedListSource.listId, { pageIndex: 0, pageToken: "" });
      setAudienceCountRefreshKey((current) => current + 1);
      setBulkUpdateStatus(`Updated ${totalUpdated.toLocaleString()} contacts across all matching results.`);
    } catch (error) {
      setBulkUpdateStatus(error.message);
    } finally {
      setBulkUpdateBusy(false);
    }
  }

  async function clearAudienceContactsForList(listId, onProgress) {
    if (!campaignApiUrl || !listId) return;
    let done = false;
    let deletedTotal = 0;
    while (!done) {
      const params = new URLSearchParams({ listId, limit: "2500" });
      const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Contact cleanup failed: ${response.status}`);
      deletedTotal += result.deleted || 0;
      done = result.done;
      const message = `Deleting contacts from DynamoDB · ${deletedTotal.toLocaleString()} removed`;
      setSheetImportStatus(message);
      onProgress?.(message);
      if (!done) await sleep(400);
    }
    setAudienceContacts((current) => current.filter((contact) => contact.listId !== listId));
    setAudienceContactCounts((current) => ({ ...current, [listId]: 0 }));
  }

  function createAudienceList(sourceType = "hubspot") {
    if (sourceType === "google_sheets") {
      setShowSheetPicker(true);
      return;
    }
    const listId = `audience-${sourceType}-${Date.now()}`;
    const list = {
      listId,
      name: sourceType === "hubspot" ? "New HubSpot audience" : "New Google Sheet audience",
      sourceType,
      sourceName: sourceType === "hubspot" ? "HubSpot contacts" : "Google Sheet import",
      hubspotImportMode: "segment",
      hubspotListId: "",
      googleSheetId: "",
      selectedFields: ["country", "technology", "persona", "jobTitle"],
      filters: [{ field: "country", operator: "equals", value: "" }],
      savedAsHubSpotSegment: sourceType === "hubspot",
      associatedCampaignIds: [],
      status: "draft",
      updatedAt: nowIso()
    };
    setAudienceLists((current) => [list, ...current]);
    setSelectedSourceId(listId);
  }

  function createGoogleSheetSource() {
    const sheetId = extractGoogleSheetId(sheetDraft.sheetId || sheetDraft.sheetUrl);
    if (!sheetId) return;
    const sheetSourceId = `sheet-source-${Date.now()}`;
    const source = {
      sheetSourceId,
      name: sheetDraft.name || "New Google Sheet",
      sheetId,
      sheetUrl: sheetDraft.sheetUrl,
      tabs: sheetDraft.tabsText
        .split(",")
        .map((tabName) => tabName.trim())
        .filter(Boolean)
        .map((tabName) => ({ tabName, headerRow: 1, notes: "" })),
      lastUsedAt: nowIso(),
      updatedAt: nowIso()
    };
    setGoogleSheetSources((current) => [source, ...current]);
    setSheetDraft({ name: "", sheetUrl: "", sheetId: "", tabsText: "Contacts" });
    createAudienceFromSheet(source, source.tabs[0]?.tabName || "Contacts");
  }

  function createAudienceFromSheet(source, tabName) {
    const listId = `audience-sheet-${Date.now()}`;
    const list = {
      listId,
      name: `${source.name} - ${tabName}`,
      sourceType: "google_sheets",
      sourceName: `Google Sheet: ${source.name} / ${tabName}`,
      hubspotListId: "",
      googleSheetId: source.sheetId,
      googleSheetSourceId: source.sheetSourceId,
      googleSheetTabName: tabName,
      googleSheetRange: "A:Z",
      selectedFields: ["country", "technology", "persona", "jobTitle"],
      filters: [{ field: "country", operator: "equals", value: "" }],
      savedAsHubSpotSegment: false,
      associatedCampaignIds: [],
      status: "draft",
      updatedAt: nowIso()
    };
    setAudienceLists((current) => [list, ...current]);
    setGoogleSheetSources((current) =>
      current.map((item) =>
        item.sheetSourceId === source.sheetSourceId
          ? {
              ...item,
              lastUsedAt: nowIso(),
              updatedAt: nowIso()
            }
          : item
      )
    );
    setSelectedSourceId(listId);
    setSelectedAudienceListId(listId);
    setShowSheetPicker(false);
  }

  function updateSource(field, value) {
    if (!selectedSource) return;
    setAudienceLists((current) =>
      current.map((list) =>
        list.listId === selectedSource.listId
          ? {
              ...list,
              [field]: value,
              updatedAt: nowIso()
            }
          : list
      )
    );
  }

  function createCampaignAudienceList() {
    if (!selectedSource) return;
    const list = buildCampaignAudienceListForSource(selectedSource);
    setAudienceLists((current) => [list, ...current]);
    setSelectedCampaignAudienceId(list.listId);
    setSelectedAudienceListId(list.listId);
  }

  function buildCampaignAudienceListForSource(source) {
    const listId = `audience-list-${Date.now()}`;
    return {
      listId,
      sourceListId: source.listId,
      name: `${source.name || "Imported audience"} - All contacts`,
      filters: [],
      associatedCampaignIds: [],
      excludedContactIds: [],
      frozen: false,
      frozenContactIds: [],
      status: "draft",
      updatedAt: nowIso()
    };
  }

  function ensureCampaignAudienceForSource(source) {
    if (!source?.listId) return "";
    const existing = campaignAudienceLists.find((list) => list.sourceListId === source.listId);
    if (existing) {
      setSelectedCampaignAudienceId(existing.listId);
      setSelectedAudienceListId(existing.listId);
      return existing.listId;
    }
    const list = buildCampaignAudienceListForSource(source);
    setAudienceLists((current) => [list, ...current]);
    setSelectedCampaignAudienceId(list.listId);
    setSelectedAudienceListId(list.listId);
    return list.listId;
  }

  function updateList(field, value) {
    if (!selectedList) return;
    setAudienceLists((current) =>
      current.map((list) =>
        list.listId === selectedList.listId
          ? {
              ...list,
              [field]: value,
              updatedAt: nowIso()
            }
          : list
      )
    );
  }

  function toggleAudienceFilterField(field, checked) {
    if (!selectedList) return;
    const currentFilters = selectedList.filters || [];
    if (checked) {
      const alreadyEnabled = currentFilters.some((filter) => filter.field === field);
      if (!alreadyEnabled) {
        const filter = field === "audienceExclusion"
          ? { field, operator: "in", value: "", values: [] }
          : { field, operator: "equals", value: "" };
        updateList("filters", [...currentFilters, filter]);
      }
      return;
    }
    updateList("filters", currentFilters.filter((filter) => filter.field !== field));
  }

  function updateFilter(index, field, value) {
    if (!selectedList) return;
    updateList(
      "filters",
      (selectedList.filters || []).map((filter, filterIndex) =>
        filterIndex === index
          ? {
              ...filter,
              [field]: value,
              ...(field === "field" && value === "audienceExclusion" ? { operator: "in", value: "", values: [] } : {}),
              ...(field === "field" && value !== "audienceExclusion" && filter.field === "audienceExclusion" ? { operator: "equals", value: "", values: undefined } : {}),
              ...(field === "operator" && value === "in" ? { values: filterValueList(filter) } : {}),
              ...(field === "operator" && value !== "in" ? { values: undefined } : {})
            }
          : filter
      )
    );
  }

  function addFilterValue(index, value) {
    if (!selectedList || !String(value || "").trim()) return;
    updateList(
      "filters",
      (selectedList.filters || []).map((filter, filterIndex) => {
        if (filterIndex !== index) return filter;
        const values = Array.from(new Set([...filterValueList(filter), String(value).trim()]));
        return {
          ...filter,
          values,
          value: values.join(", ")
        };
      })
    );
  }

  function removeFilterValue(index, value) {
    if (!selectedList) return;
    updateList(
      "filters",
      (selectedList.filters || []).map((filter, filterIndex) => {
        if (filterIndex !== index) return filter;
        const values = filterValueList(filter).filter((item) => item !== value);
        return {
          ...filter,
          values,
          value: values.join(", ")
        };
      })
    );
  }

  function addFilter() {
    if (!selectedList) return;
    updateList("filters", [...(selectedList.filters || []), { field: "country", operator: "equals", value: "" }]);
  }

  function removeFilter(index) {
    if (!selectedList) return;
    updateList("filters", (selectedList.filters || []).filter((_, filterIndex) => filterIndex !== index));
  }

  function addAudienceListCampaignFilter(campaignId) {
    if (!campaignId) return;
    setAudienceListCampaignFilters((current) => Array.from(new Set([...current, campaignId])));
  }

  function removeAudienceListCampaignFilter(campaignId) {
    setAudienceListCampaignFilters((current) => current.filter((id) => id !== campaignId));
  }

  async function fetchHubSpotListOptions(query = "", options = {}) {
    if (!campaignApiUrl) return;
    const importMode = options.hubspotImportMode || selectedSource?.hubspotImportMode || "segment";
    if (!options.silent) setHubspotListStatus(importMode === "company_segment" ? "Loading HubSpot company lists..." : "Loading HubSpot contact lists...");
    try {
      const params = new URLSearchParams({ count: "200", hubspotImportMode: importMode, query });
      const response = await fetch(`${campaignApiUrl}/hubspot/lists?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HubSpot list lookup failed: ${response.status}`);
      if (options.cancelled?.()) return;
      setHubspotListOptions(result.lists || []);
      setHubspotListStatus(`${(result.lists || []).length.toLocaleString()} HubSpot ${importMode === "company_segment" ? "company" : "contact"} lists available${result.hasMore ? " - refine in HubSpot or paste the ID if needed" : ""}.`);
    } catch (error) {
      if (options.cancelled?.()) return;
      setHubspotListStatus(`HubSpot list lookup failed: ${error.message}`);
    }
  }

  function updateHubSpotImportMode(value) {
    updateSource("hubspotImportMode", value);
    setHubspotListOptions([]);
    setHubspotListStatus("");
  }

  function updateHubSpotListSelection(value) {
    if (!selectedSource) return;
    const selectedHubSpotList = hubspotListOptions.find((list) => list.listId === value);
    setAudienceLists((current) =>
      current.map((list) =>
        list.listId === selectedSource.listId
          ? {
              ...list,
              hubspotListId: value,
              ...(selectedHubSpotList ? { sourceName: `HubSpot list/segment: ${selectedHubSpotList.name || selectedHubSpotList.listId}` } : {}),
              updatedAt: nowIso()
            }
          : list
      )
    );
  }

  async function refreshGoogleSheetRows() {
    if (!selectedSource?.googleSheetId || !selectedSource?.googleSheetTabName) return;
    setSheetImportStatus("Starting Google Sheet import job...");
    try {
      let rows = [];
      if (campaignApiUrl) {
        await clearAudienceContactsForList(selectedSource.listId);
        let done = false;
        let startRow = 2;
        let importedTotal = 0;
        let skippedTotal = 0;
        let sheetHeaders = null;
        let sheetColumnMap = selectedSource.sheetColumnMap || null;
        let sheetMappingMode = selectedSource.sheetMappingMode || "";
        while (!done) {
          const response = await fetch(`${campaignApiUrl}/google-sheets/import-batch`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders
            },
            body: JSON.stringify({
              batchSize: 1000,
              columnMap: sheetColumnMap,
              headers: sheetHeaders,
              listId: selectedSource.listId,
              range: selectedSource.googleSheetRange || "A:Z",
              reset: false,
              sheetId: selectedSource.googleSheetId,
              startRow,
              tabName: selectedSource.googleSheetTabName
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || `Google Sheets import failed: ${response.status}`);
          sheetHeaders = result.headers || sheetHeaders;
          sheetColumnMap = result.columnMap || sheetColumnMap;
          sheetMappingMode = result.mappingMode || sheetMappingMode;
          if (result.columnMap) {
            setAudienceLists((current) =>
              current.map((list) =>
                list.listId === selectedSource.listId
                  ? {
                      ...list,
                      sheetColumnMap: result.columnMap,
                      sheetMappingMode: result.mappingMode,
                      sheetMappingConfidence: result.mappingConfidence,
                      sheetMappingNotes: result.mappingNotes || [],
                      updatedAt: nowIso()
                    }
                  : list
              )
            );
          }
          importedTotal += result.imported || 0;
          skippedTotal += result.skipped || 0;
          done = result.done;
          startRow = result.nextStartRow;
          const mappingLabel = sheetMappingMode ? ` · ${formatSheetMappingMode(sheetMappingMode)} mapping` : "";
          setSheetImportStatus(`Importing rows ${result.startRow}-${Math.max(result.startRow, result.nextStartRow - 1)} · ${importedTotal.toLocaleString()} contacts saved${mappingLabel}`);
          if (!done) await sleep(1200);
        }
        setAudienceContactCounts((current) => ({ ...current, [selectedSource.listId]: importedTotal }));
        setContactPageTokens([""]);
        setContactNextToken("");
        await fetchAudienceContactsPage(selectedSource.listId, { pageIndex: 0, pageToken: "" });
        updateSource("lastImportedAt", nowIso());
        const mappingLabel = sheetMappingMode ? ` ${formatSheetMappingMode(sheetMappingMode)} mapping used.` : "";
        setSheetImportStatus(`Import complete: ${importedTotal.toLocaleString()} contacts saved, ${skippedTotal.toLocaleString()} rows skipped.${mappingLabel}`);
        return;
      } else {
        const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(selectedSource.googleSheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(selectedSource.googleSheetTabName)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
        rows = parseCsvRows(await response.text());
      }
      if (rows.length < 2) throw new Error("No data rows found in that worksheet tab");
      const contacts = rowsToSheetContacts({
        rows,
        listId: selectedSource.listId,
        sheetId: selectedSource.googleSheetId,
        tabName: selectedSource.googleSheetTabName,
        importRunId: Date.now()
      });
      if (!contacts.length) throw new Error("No usable contact rows found. Check that the sheet has headers such as email, name, company, country, title, or stage.");
      const replacedContacts = audienceContacts.filter((contact) => contact.listId === selectedSource.listId);
      setAudienceContacts((current) => [...current.filter((contact) => contact.listId !== selectedSource.listId), ...contacts]);
      setDeletedAudienceContacts((current) => [
        ...current,
        ...replacedContacts.map((contact) => ({ listId: contact.listId, contactId: contact.contactId }))
      ]);
      updateSource("lastImportedAt", nowIso());
      setSheetImportStatus((current) => current.includes("Imported first") ? current : `Imported ${contacts.length} rows from ${selectedSource.googleSheetTabName}.`);
    } catch (error) {
      const message = String(error.message || "");
      setSheetImportStatus(message.includes("RATE_LIMIT_EXCEEDED") || message.includes("Quota exceeded")
        ? "Google Sheets rate limit reached. Wait about a minute, then run the import again; saved contacts from completed batches are already in DynamoDB."
        : `${message}. Share the Sheet with the configured service account email, and confirm the Google Sheets API is enabled for that Google project.`);
    }
  }

  async function refreshHubSpotRows() {
    if (!selectedSource || selectedSource.sourceType !== "hubspot" || !campaignApiUrl) return;
    const importMode = selectedSource.hubspotImportMode || "segment";
    if (["segment", "company_segment"].includes(importMode) && !selectedSource.hubspotListId) {
      setSheetImportStatus("Add the HubSpot segment/list ID before importing.");
      return;
    }
    setSheetImportStatus(importMode === "contacts" ? "Starting HubSpot contacts import..." : "Starting HubSpot segment import...");
    try {
      let done = false;
      let after = "";
      let firstBatch = true;
      let importedTotal = 0;
      let skippedTotal = 0;
      let readTotal = 0;
      const endpoint = importMode === "contacts" ? "/hubspot/import-contacts-batch" : "/hubspot/import-segment-batch";
      while (!done) {
        const response = await fetch(`${campaignApiUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            after,
            batchSize: 100,
            hubspotListId: selectedSource.hubspotListId,
            hubspotImportMode: importMode,
            listId: selectedSource.listId,
            reset: firstBatch
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `HubSpot import failed: ${response.status}`);
        importedTotal += result.imported || 0;
        skippedTotal += result.skipped || 0;
        readTotal += result.readMemberships || result.readCompanies || result.readContacts || 0;
        done = result.done;
        after = result.nextAfter || "";
        firstBatch = false;
        setSheetImportStatus(`HubSpot import: ${importedTotal.toLocaleString()} contacts saved, ${skippedTotal.toLocaleString()} skipped, ${readTotal.toLocaleString()} records read...`);
        if (!done) await sleep(250);
      }
      const updatedSource = {
        ...selectedSource,
        sourceName: importMode === "contacts"
          ? "HubSpot contacts"
          : importMode === "company_segment"
            ? `HubSpot company segment ${selectedSource.hubspotListId}`
            : `HubSpot contact segment ${selectedSource.hubspotListId}`,
        status: "ready",
        lastImportedAt: nowIso(),
        updatedAt: nowIso()
      };
      setAudienceLists((current) =>
        current.map((list) =>
          list.listId === selectedSource.listId
            ? updatedSource
            : list
        )
      );
      ensureCampaignAudienceForSource(updatedSource);
      setAudienceContactCounts((current) => ({ ...current, [selectedSource.listId]: importedTotal }));
      setContactPageTokens([""]);
      setContactNextToken("");
      await fetchAudienceContactsPage(selectedSource.listId, { pageIndex: 0, pageToken: "" });
      setSheetImportStatus(`HubSpot import complete: ${importedTotal.toLocaleString()} contacts saved, ${skippedTotal.toLocaleString()} skipped.`);
    } catch (error) {
      setSheetImportStatus(`HubSpot import failed: ${error.message}`);
    }
  }

  function cloneCampaignAudienceList(list) {
    const listId = `audience-clone-${Date.now()}`;
    setAudienceLists((current) => [
      {
        ...list,
        listId,
        name: `${list.name} copy`,
        status: "draft",
        updatedAt: nowIso()
      },
      ...current
    ]);
    setSelectedCampaignAudienceId(listId);
    setSelectedAudienceListId(listId);
  }

  function deleteCampaignAudienceList(list) {
    const nextListId = campaignAudienceLists.find((item) => item.listId !== list.listId)?.listId || "";
    setAudienceLists((current) => current.filter((item) => item.listId !== list.listId));
    setDeletedAudienceListIds((current) => Array.from(new Set([...current, list.listId])));
    setSelectedCampaignAudienceId((current) => {
      if (current !== list.listId) return current;
      return nextListId;
    });
    setSelectedAudienceListId((current) => {
      if (current !== list.listId) return current;
      return nextListId;
    });
  }

  function openDeleteSourceDialog(list) {
    setDeleteSourceDraft(list);
    setDeleteSourceConfirmText("");
    setDeleteSourceStatus("");
    setDeleteSourceBusy(false);
  }

  function closeDeleteSourceDialog() {
    if (deleteSourceBusy) return;
    setDeleteSourceDraft(null);
    setDeleteSourceConfirmText("");
    setDeleteSourceStatus("");
  }

  async function confirmDeleteSource() {
    if (!deleteSourceDraft || deleteSourceBusy || deleteSourceConfirmText.trim().toLowerCase() !== "delete") return;
    setDeleteSourceBusy(true);
    setDeleteSourceStatus("Starting delete...");
    const deleted = await deleteSource(deleteSourceDraft, setDeleteSourceStatus);
    if (deleted) {
      setDeleteSourceBusy(false);
      setDeleteSourceDraft(null);
      setDeleteSourceConfirmText("");
      setDeleteSourceStatus("");
      return;
    }
    setDeleteSourceBusy(false);
  }

  async function deleteSource(list, onProgress) {
    const relatedListIds = [list.listId, ...campaignAudienceLists.filter((item) => item.sourceListId === list.listId).map((item) => item.listId)];
    if (campaignApiUrl) {
      try {
        const startMessage = `Deleting ${list.name} contacts from DynamoDB...`;
        setSheetImportStatus(startMessage);
        onProgress?.(startMessage);
        await clearAudienceContactsForList(list.listId, onProgress);
        const doneMessage = `Deleted ${list.name} and its imported contacts.`;
        setSheetImportStatus(doneMessage);
        onProgress?.(doneMessage);
      } catch (error) {
        const message = `Delete failed: ${error.message}`;
        setSheetImportStatus(message);
        onProgress?.(message);
        return false;
      }
    }
    onProgress?.("Removing source and derived audience lists...");
    setAudienceLists((current) => current.filter((item) => !relatedListIds.includes(item.listId)));
    setAudienceContacts((current) => current.filter((contact) => contact.listId !== list.listId));
    setDeletedAudienceListIds((current) => Array.from(new Set([...current, ...relatedListIds])));
    if (!campaignApiUrl) {
      setDeletedAudienceContacts((current) => [
        ...current,
        ...audienceContacts.filter((contact) => contact.listId === list.listId).map((contact) => ({ listId: contact.listId, contactId: contact.contactId }))
      ]);
    }
    const nextReusableListId = campaignAudienceLists.find((item) => !relatedListIds.includes(item.listId))?.listId || "";
    setSelectedAudienceListId((current) => {
      if (!relatedListIds.includes(current)) return current;
      return nextReusableListId;
    });
    setSelectedSourceId((current) => {
      if (current !== list.listId) return current;
      return audienceSources.find((item) => item.listId !== list.listId)?.listId;
    });
    setSelectedCampaignAudienceId((current) => {
      if (!relatedListIds.includes(current)) return current;
      return nextReusableListId;
    });
    return true;
  }

  function associateListToCampaign(list, campaignId) {
    const associatedCampaignIds = list.associatedCampaignIds || [];
    updateSpecificList(list.listId, "associatedCampaignIds", campaignId ? Array.from(new Set([...associatedCampaignIds, campaignId])) : associatedCampaignIds);
  }

  function setListCampaignAssociation(list, campaignId, checked) {
    const associatedCampaignIds = list.associatedCampaignIds || [];
    const nextIds = checked
      ? Array.from(new Set([...associatedCampaignIds, campaignId]))
      : associatedCampaignIds.filter((id) => id !== campaignId);
    updateSpecificList(list.listId, "associatedCampaignIds", nextIds);
  }

  function updateSpecificList(listId, field, value) {
    setAudienceLists((current) =>
      current.map((list) =>
        list.listId === listId
          ? {
              ...list,
              [field]: value,
              updatedAt: nowIso()
            }
          : list
      )
    );
  }

  function updateContact(contactId, field, value) {
    if (!selectedListSource) return;
    setAudienceContacts((current) =>
      current.map((contact) =>
        contact.listId === selectedListSource.listId && contact.contactId === contactId
          ? {
              ...contact,
              [field]: field === "email" ? value.toLowerCase() : value
            }
          : contact
      )
    );
    if (hubSpotSyncableContactFields.includes(field)) {
      setDirtyContactFields((current) => ({
        ...current,
        [contactId]: Array.from(new Set([...(current[contactId] || []), field]))
      }));
    }
  }

  async function saveContact(contactId) {
    if (!selectedListSource) return;
    const targetContact = audienceContacts.find((contact) => contact.listId === selectedListSource.listId && contact.contactId === contactId);
    if (campaignApiUrl && targetContact) {
      try {
        const response = await fetch(`${campaignApiUrl}/audience-contacts`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify(targetContact)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Contact save failed: ${response.status}`);
      } catch (error) {
        setContactLoadStatus(error.message);
        return;
      }
    }
    setAudienceContacts((current) =>
      current.map((contact) =>
        contact.listId === selectedListSource.listId && contact.contactId === contactId
          ? {
              ...contact,
              updatedAt: nowIso()
            }
          : contact
      )
    );
  }

  async function syncContactToHubSpot(contact) {
    const changedFields = (dirtyContactFields[contact.contactId] || []).filter((field) => hubSpotSyncableContactFields.includes(field));
    if (!campaignApiUrl || !contact.hubspotRecordId || !changedFields.length) return;
    setSyncingContactIds((current) => ({ ...current, [contact.contactId]: true }));
    setContactSyncStatus((current) => ({ ...current, [contact.contactId]: "Syncing to HubSpot..." }));
    try {
      const response = await fetch(`${campaignApiUrl}/hubspot/sync-contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          contact,
          fields: changedFields
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HubSpot sync failed: ${response.status}`);
      const updatedContact = result.contact || contact;
      setAudienceContacts((current) =>
        current.map((item) =>
          item.listId === updatedContact.listId && item.contactId === updatedContact.contactId
            ? updatedContact
            : item
        )
      );
      setDirtyContactFields((current) => {
        const next = { ...current };
        delete next[contact.contactId];
        return next;
      });
      setContactSyncStatus((current) => ({ ...current, [contact.contactId]: `Synced ${changedFields.length} field${changedFields.length === 1 ? "" : "s"}` }));
    } catch (error) {
      setContactSyncStatus((current) => ({ ...current, [contact.contactId]: error.message }));
    } finally {
      setSyncingContactIds((current) => {
        const next = { ...current };
        delete next[contact.contactId];
        return next;
      });
    }
  }

  function removeContactFromList(contact) {
    if (!selectedList) return;
    if (selectedList.frozen) {
      updateList("frozenContactIds", (selectedList.frozenContactIds || []).filter((id) => id !== contact.contactId));
      return;
    }
    updateList("excludedContactIds", Array.from(new Set([...(selectedList.excludedContactIds || []), contact.contactId])));
  }

  function freezeAudienceList() {
    if (!selectedList) return;
    setAudienceLists((current) =>
      current.map((list) =>
        list.listId === selectedList.listId
          ? {
              ...list,
              frozen: true,
              frozenContactIds: dynamicAudienceContacts.map((contact) => contact.contactId),
              updatedAt: nowIso()
            }
          : list
      )
    );
  }

  function unfreezeAudienceList() {
    if (!selectedList) return;
    updateList("frozen", false);
  }

  async function exportSelectedAudienceToHubSpot() {
    if (!campaignApiUrl || !selectedList) return;
    const defaultName = selectedList.hubspotListName || selectedList.name || "CloudCamp audience";
    const hubspotListName = window.prompt("HubSpot segment name", defaultName);
    if (!hubspotListName) return;
    setHubspotExportBusy(true);
    setHubspotExportStatus("Exporting the selected reusable filtered audience to HubSpot...");
    try {
      const response = await fetch(`${campaignApiUrl}/hubspot/export-audience`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          audienceListId: selectedList.listId,
          createCompanies: false,
          hubspotListName,
          limit: 1000
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HubSpot export failed: ${response.status}`);
      if (result.audienceList) {
        setAudienceLists((current) => current.map((list) => list.listId === result.audienceList.listId ? result.audienceList : list));
      }
      setHubspotExportStatus(`Exported ${Number(result.contactsExported || 0).toLocaleString()} contacts to HubSpot segment ${result.hubspotListId}. Future sync should use HubSpot for this audience.`);
      if (result.limited) setHubspotExportStatus((current) => `${current} Export was capped at 1,000 contacts; use a narrower reusable audience or we can move this to a background job.`);
    } catch (error) {
      setHubspotExportStatus(error.message);
    } finally {
      setHubspotExportBusy(false);
    }
  }

  return (
    <div className="audience-workspace">
      <section className="panel audience-source-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Audience source</p>
            <h2>Lists and segments</h2>
          </div>
          <div className="editor-actions">
            <button className="primary-button compact" onClick={() => createAudienceList("hubspot")}>
              <Plus size={15} />
              HubSpot
            </button>
            <button className="primary-button compact" onClick={() => createAudienceList("google_sheets")}>
              <Plus size={15} />
              Sheet
            </button>
          </div>
        </div>
        <div className="audience-list-stack">
          {audienceSources.map((list) => (
            <article className={`audience-list-card ${list.listId === selectedSource?.listId ? "selected" : ""}`} key={list.listId}>
              <button
                className="audience-list-main"
                onClick={() => {
                  setSelectedSourceId(list.listId);
                }}
              >
                <strong>{list.name}</strong>
                <span>{list.sourceType === "hubspot" ? (list.hubspotImportMode === "contacts" ? "HubSpot contacts" : list.hubspotImportMode === "company_segment" ? "HubSpot company segment" : "HubSpot contact segment") : "Google Sheet list"}</span>
                <small>{(audienceContactCounts[list.listId] ?? audienceContacts.filter((contact) => contact.listId === list.listId).length).toLocaleString()} contacts · {list.status}</small>
              </button>
              <div className="audience-list-actions">
                <button className="icon-button compact danger" title="Delete source and imported contacts" onClick={() => openDeleteSourceDialog(list)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
          {!audienceSources.length && <p>No imported sources yet. Add HubSpot or Sheet to start.</p>}
        </div>
      </section>

      {deleteSourceDraft && (
        <div className="modal-backdrop" role="presentation">
          <section className="panel delete-confirm-panel" role="dialog" aria-modal="true" aria-label="Confirm source deletion">
            <div className="section-head">
              <div>
                <p className="eyebrow">Destructive action</p>
                <h2>Delete audience source?</h2>
              </div>
              <button className="icon-button compact" title="Close" onClick={closeDeleteSourceDialog} disabled={deleteSourceBusy}>
                <X size={15} />
              </button>
            </div>
            <div className="delete-warning">
              <Trash2 size={22} />
              <div>
                <strong>This will permanently remove imported contact rows from DynamoDB.</strong>
                <span>Deleting this source also removes reusable audience lists created from it.</span>
              </div>
            </div>
            <div className="delete-impact-list">
              <span><strong>Source</strong>{deleteSourceDraft.name}</span>
              <span><strong>Imported contacts</strong>{(audienceContactCounts[deleteSourceDraft.listId] ?? audienceContacts.filter((contact) => contact.listId === deleteSourceDraft.listId).length).toLocaleString()}</span>
              <span><strong>Derived audience lists</strong>{campaignAudienceLists.filter((list) => list.sourceListId === deleteSourceDraft.listId).length.toLocaleString()}</span>
              <span><strong>DynamoDB table</strong>CampaignAudienceContacts-dev</span>
            </div>
            {campaignAudienceLists.some((list) => list.sourceListId === deleteSourceDraft.listId) && (
              <div className="delete-derived-list">
                {campaignAudienceLists.filter((list) => list.sourceListId === deleteSourceDraft.listId).map((list) => (
                  <span key={list.listId}>{list.name}</span>
                ))}
              </div>
            )}
            <label className="delete-confirm-input">
              <span>Type <strong>delete</strong> to confirm</span>
              <input value={deleteSourceConfirmText} onChange={(event) => setDeleteSourceConfirmText(event.target.value)} placeholder="delete" autoFocus disabled={deleteSourceBusy} />
            </label>
            {deleteSourceStatus && <div className="delete-progress">{deleteSourceStatus}</div>}
            <div className="editor-actions delete-actions">
              <button className="secondary-button" onClick={closeDeleteSourceDialog} disabled={deleteSourceBusy}>Cancel</button>
              <button className="primary-button danger-action" onClick={confirmDeleteSource} disabled={deleteSourceBusy || deleteSourceConfirmText.trim().toLowerCase() !== "delete"}>
                <Trash2 size={15} />
                {deleteSourceBusy ? "Deleting..." : "Delete source and contacts"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showSheetPicker && (
        <div className="modal-backdrop" role="presentation">
          <section className="panel sheet-picker-panel" role="dialog" aria-modal="true" aria-label="Add Google Sheet audience">
            <div className="section-head">
              <div>
                <p className="eyebrow">Google Sheets source</p>
                <h2>Add audience from Sheet</h2>
              </div>
              <button className="icon-button compact" title="Close" onClick={() => setShowSheetPicker(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="sheet-picker-grid">
              <div className="saved-sheets-panel">
                <h3>Used before</h3>
                {googleSheetSources.length ? (
                  <div className="saved-sheet-list">
                    {googleSheetSources.map((source) => (
                      <article key={source.sheetSourceId} className="saved-sheet-card">
                        <strong>{source.name}</strong>
                        <span>{source.sheetId}</span>
                        <small>{source.tabs?.length || 0} tabs saved</small>
                        <div className="sheet-tab-list">
                          {(source.tabs || []).map((tab) => (
                            <button key={tab.tabName} className="secondary-button compact" onClick={() => createAudienceFromSheet(source, tab.tabName)}>
                              <FileText size={13} />
                              {tab.tabName}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>No Sheets have been saved yet.</p>
                )}
              </div>
              <div className="new-sheet-panel">
                <h3>New Sheet</h3>
                <p>For now, save the Sheet ID or URL and define the worksheet tabs manually. Google auth can later auto-discover tabs, columns, and refresh contacts against this same saved source.</p>
                <label>
                  <span>Sheet label</span>
                  <input value={sheetDraft.name} onChange={(event) => setSheetDraft((current) => ({ ...current, name: event.target.value }))} placeholder="MDF Windows audience workbook" />
                </label>
                <label>
                  <span>Google Sheet URL or ID</span>
                  <input value={sheetDraft.sheetUrl || sheetDraft.sheetId} onChange={(event) => setSheetDraft((current) => ({ ...current, sheetUrl: event.target.value, sheetId: extractGoogleSheetId(event.target.value) }))} placeholder="https://docs.google.com/spreadsheets/d/..." />
                </label>
                <label>
                  <span>Worksheet tabs</span>
                  <input value={sheetDraft.tabsText} onChange={(event) => setSheetDraft((current) => ({ ...current, tabsText: event.target.value }))} placeholder="CTO, CFO, ITM" />
                </label>
                <button className="primary-button" onClick={createGoogleSheetSource} disabled={!extractGoogleSheetId(sheetDraft.sheetId || sheetDraft.sheetUrl)}>
                  <Plus size={15} />
                  Save Sheet and create audience
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedSource && (
        <section className="panel audience-builder-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">{selectedSource.sourceType === "hubspot" ? "HubSpot" : "Google Sheets"} import source</p>
              <h2>{selectedSource.name}</h2>
            </div>
            <span className={`source-pill ${selectedSource.sourceType}`}>{selectedSource.sourceType === "hubspot" ? "HubSpot source" : "DynamoDB import"}</span>
          </div>
          <div className="audience-form">
            <label>
              <span>Source name</span>
              <input value={selectedSource.name || ""} onChange={(event) => updateSource("name", event.target.value)} />
            </label>
            <label>
              <span>Source detail</span>
              <input value={selectedSource.sourceName || ""} onChange={(event) => updateSource("sourceName", event.target.value)} />
            </label>
            <label className={selectedSource.sourceType !== "hubspot" ? "inactive-source-field" : ""}>
              <span>HubSpot import type</span>
              <select value={selectedSource.hubspotImportMode || "segment"} onChange={(event) => updateHubSpotImportMode(event.target.value)} disabled={selectedSource.sourceType !== "hubspot"}>
                <option value="segment">Contact segment/list</option>
                <option value="company_segment">Company segment/list contacts</option>
                <option value="contacts">All contacts</option>
              </select>
            </label>
            <label className={selectedSource.sourceType !== "hubspot" || selectedSource.hubspotImportMode === "contacts" ? "inactive-source-field" : ""}>
              <span>HubSpot list/segment ID</span>
              <input
                value={selectedSource.hubspotListId || ""}
                list={`hubspot-list-options-${selectedSource.listId}`}
                onFocus={() => fetchHubSpotListOptions("", { silent: true })}
                onChange={(event) => updateHubSpotListSelection(event.target.value)}
                placeholder="Pick a HubSpot segment or paste ID"
                disabled={selectedSource.sourceType !== "hubspot" || selectedSource.hubspotImportMode === "contacts"}
              />
              <datalist id={`hubspot-list-options-${selectedSource.listId}`}>
                {hubspotListOptions.map((list) => (
                  <option key={list.listId} value={list.listId} label={`${list.name || list.listId}${list.processingType ? ` - ${list.processingType}` : ""}`} />
                ))}
              </datalist>
              {selectedSource.sourceType === "hubspot" && ["segment", "company_segment"].includes(selectedSource.hubspotImportMode || "segment") && (
                <div className="hubspot-list-picker-meta">
                  <button className="secondary-button compact" type="button" onClick={() => fetchHubSpotListOptions()}>
                    <RotateCcw size={13} />
                    Refresh lists
                  </button>
                  <small>{hubspotListStatus || "Start typing or refresh to load HubSpot lists/segments."}</small>
                </div>
              )}
            </label>
            <label className={selectedSource.sourceType !== "google_sheets" ? "inactive-source-field" : ""}>
              <span>Google Sheet ID</span>
              <input value={selectedSource.googleSheetId || ""} onChange={(event) => updateSource("googleSheetId", event.target.value)} disabled={selectedSource.sourceType !== "google_sheets"} />
            </label>
            <label className={selectedSource.sourceType !== "google_sheets" ? "inactive-source-field" : ""}>
              <span>Worksheet tab</span>
              <input value={selectedSource.googleSheetTabName || ""} onChange={(event) => updateSource("googleSheetTabName", event.target.value)} disabled={selectedSource.sourceType !== "google_sheets"} />
            </label>
            <label className={selectedSource.sourceType !== "google_sheets" ? "inactive-source-field" : ""}>
              <span>Read range</span>
              <input value={selectedSource.googleSheetRange || "A:Z"} onChange={(event) => updateSource("googleSheetRange", event.target.value)} disabled={selectedSource.sourceType !== "google_sheets"} />
            </label>
          </div>

          {selectedSource.sourceType === "google_sheets" && (
            <div className="sheet-import-bar">
              <button className="primary-button compact" onClick={refreshGoogleSheetRows} disabled={!selectedSource.googleSheetId || !selectedSource.googleSheetTabName}>
                <Database size={15} />
                Import Sheet rows
              </button>
              {selectedSource.sheetMappingMode && (
                <span className="source-pill google_sheets">{formatSheetMappingMode(selectedSource.sheetMappingMode)} mapping</span>
              )}
              <span>{sheetImportStatus || "Imports save source contacts once. Audience lists below reuse this imported data."}</span>
            </div>
          )}

          {selectedSource.sourceType === "hubspot" && (
            <div className="sheet-import-bar">
              <button
                className="primary-button compact"
                onClick={refreshHubSpotRows}
                disabled={!campaignApiUrl || (["segment", "company_segment"].includes(selectedSource.hubspotImportMode || "segment") && !selectedSource.hubspotListId)}
              >
                <Database size={15} />
                {(selectedSource.hubspotImportMode || "segment") === "contacts"
                  ? "Import HubSpot contacts"
                  : (selectedSource.hubspotImportMode || "segment") === "company_segment"
                    ? "Import company segment contacts"
                    : "Import contact segment"}
              </button>
              <span>
                {sheetImportStatus || ((selectedSource.hubspotImportMode || "segment") === "contacts"
                  ? "Imports HubSpot contacts into DynamoDB so reusable audiences can be built here."
                  : (selectedSource.hubspotImportMode || "segment") === "company_segment"
                    ? "Imports companies from the selected HubSpot segment/list, then imports their associated contacts."
                    : "Imports contacts from the selected HubSpot segment/list into DynamoDB.")}
              </span>
            </div>
          )}

        </section>
      )}

      <section className="panel audience-lists-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Audience lists</p>
            <h2>Reusable filtered audiences</h2>
          </div>
          <div className="editor-actions">
            <button className="secondary-button compact" onClick={() => setAudienceListsCollapsed((current) => !current)}>
              {audienceListsCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              {audienceListsCollapsed ? "Show lists" : "Hide lists"}
            </button>
            <button className="primary-button compact" onClick={createCampaignAudienceList} disabled={!selectedSource}>
              <Plus size={15} />
              Audience List
            </button>
          </div>
        </div>

        <div className="audience-list-toolbar">
          <div>
            <strong>{visibleCampaignAudienceLists.length.toLocaleString()} shown</strong>
            <span>{campaignAudienceLists.length.toLocaleString()} saved reusable audiences</span>
          </div>
          <label>
            <span>Assigned campaign quick pick</span>
            <select value="" onChange={(event) => addAudienceListCampaignFilter(event.target.value)}>
              <option value="">Add campaign filter...</option>
              {campaigns
                .filter((campaign) => !audienceListCampaignFilters.includes(campaign.id))
                .map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
                ))}
            </select>
          </label>
          {!!audienceListCampaignFilters.length && (
            <div className="selected-filter-values audience-list-filter-chips">
              {audienceListCampaignFilters.map((campaignId) => (
                <span className="filter-value-chip" key={campaignId}>
                  {campaigns.find((campaign) => campaign.id === campaignId)?.shortName || campaignId}
                  <button title="Remove campaign filter" onClick={() => removeAudienceListCampaignFilter(campaignId)} type="button">x</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={`audience-list-split ${audienceListsCollapsed ? "lists-collapsed" : ""}`}>
          {!audienceListsCollapsed && (
          <div className="audience-list-stack compact-stack">
            {visibleCampaignAudienceLists.map((list) => {
              const source = audienceSources.find((item) => item.listId === list.sourceListId);
              const sourceCount = audienceContactCounts[list.sourceListId] ?? audienceContacts.filter((contact) => contact.listId === list.sourceListId).length;
              const listExclusionEmails = buildAudienceExclusionEmails(list.filters || [], campaignAudienceLists, audienceContacts, compliance);
              const matched = applyAudienceFilters(
                audienceContacts.filter((contact) => contact.listId === list.sourceListId),
                list.filters || [],
                compliance,
                { audienceExclusionEmails: listExclusionEmails }
              ).filter((contact) => !(list.excludedContactIds || []).includes(contact.contactId));
              const matchedCount = list.frozen ? (list.frozenContactIds || []).length : matched.length;
              return (
                <article className={`audience-list-card ${list.listId === selectedList?.listId ? "selected" : ""}`} key={list.listId}>
                  <button
                    className="audience-list-main"
                    onClick={() => {
                      setSelectedCampaignAudienceId(list.listId);
                      setSelectedAudienceListId(list.listId);
                      if (list.sourceListId) setSelectedSourceId(list.sourceListId);
                    }}
                  >
                    <strong>{list.name}</strong>
                    <span>{source?.name || "Missing source"}</span>
                    <small>{matchedCount}/{sourceCount} contacts · {list.frozen ? "frozen" : "dynamic"}</small>
                  </button>
                  <div className="audience-list-actions derived">
                    <button className="icon-button compact" title="Clone audience list" onClick={() => cloneCampaignAudienceList(list)}>
                      <Copy size={14} />
                    </button>
                    <button className="icon-button compact danger" title="Delete audience list" onClick={() => deleteCampaignAudienceList(list)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {!!list.associatedCampaignIds?.length && (
                    <div className="audience-associations">
                      {list.associatedCampaignIds.map((id) => (
                        <span key={id}>{campaigns.find((campaign) => campaign.id === id)?.shortName || id}</span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {!campaignAudienceLists.length && <p>Create an audience list from an imported source, then apply filters and campaign assignments.</p>}
            {!!campaignAudienceLists.length && !visibleCampaignAudienceLists.length && <p>No saved audiences match the selected campaign filters.</p>}
          </div>
          )}

          {selectedList ? (
            <div className="audience-list-builder">
              <div className="audience-form">
                <label>
                  <span>Audience list name</span>
                  <input value={selectedList.name || ""} onChange={(event) => updateList("name", event.target.value)} />
                </label>
                <label>
                  <span>Imported source</span>
                  <select
                    value={selectedList.sourceListId || ""}
                    onChange={(event) => {
                      updateList("sourceListId", event.target.value);
                      setSelectedSourceId(event.target.value);
                    }}
                  >
                    {audienceSources.map((source) => (
                      <option key={source.listId} value={source.listId}>{source.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="sheet-import-bar">
                <button className="primary-button compact" onClick={selectedList.frozen ? unfreezeAudienceList : freezeAudienceList}>
                  <Database size={15} />
                  {selectedList.frozen ? "Unfreeze list" : "Freeze list"}
                </button>
                <button className="secondary-button compact" onClick={exportSelectedAudienceToHubSpot} disabled={!campaignApiUrl || hubspotExportBusy}>
                  <PlugZap size={15} />
                  {hubspotExportBusy ? "Exporting" : "Export filtered audience to HubSpot"}
                </button>
                <span>
                  {selectedList.frozen
                    ? `${(selectedList.frozenContactIds || []).length.toLocaleString()} contacts locked. Removed contacts stay out of this list.`
                    : `${audienceMatchCount === null ? dynamicAudienceContacts.length.toLocaleString() : audienceMatchCount.toLocaleString()} contacts match the current filters. Freeze before sending to preserve the exact audience.`}
                </span>
              </div>
              {hubspotExportStatus && <p className="save-status">{hubspotExportStatus}</p>}

              <div className="field-picker list-filter-picker">
                {audienceFilterOptions.map((field) => (
                  <label key={field.key}>
                    <input
                      type="checkbox"
                      checked={(selectedList.filters || []).some((filter) => filter.field === field.key)}
                      onChange={(event) => toggleAudienceFilterField(field.key, event.target.checked)}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>

              <div className="filter-builder">
                <div className="panel-head">
                  <h3>Filters</h3>
                  <button className="icon-button compact" title="Add filter" onClick={addFilter}>
                    <Plus size={15} />
                  </button>
                </div>
                {(selectedList.filters || []).map((filter, index) => {
                  const isAudienceExclusionFilter = filter.field === "audienceExclusion";
                  const selectedValues = filterValueList(filter);
                  const availableAudienceListPicks = campaignAudienceLists.filter((list) => list.listId !== selectedList.listId && !selectedValues.includes(list.listId));
                  const facetKey = selectedListSource?.listId ? `${selectedListSource.listId}:${filter.field}` : "";
                  const fieldFacet = facetKey ? audienceFieldFacets[facetKey] : null;
                  const fieldFacetValues = (fieldFacet?.options || []).map((option) => option.value);
                  const sourceQuickPickValues = fieldFacetValues.length ? fieldFacetValues : quickPickValues(sourceContacts, filter.field);
                  const availableQuickPicks = isAudienceExclusionFilter
                    ? availableAudienceListPicks.map((list) => list.listId)
                    : sourceQuickPickValues.filter((value) => !selectedValues.includes(value));
                  return (
                    <div className="filter-row" key={`${filter.field}-${index}`}>
                      <select
                        value={filter.field}
                        onChange={(event) => {
                          updateFilter(index, "field", event.target.value);
                          loadAudienceFieldFacet(event.target.value);
                        }}
                      >
                        {audienceFilterOptions.map((field) => (
                          <option key={field.key} value={field.key}>{field.label}</option>
                        ))}
                      </select>
                      <select value={isAudienceExclusionFilter ? "in" : filter.operator} onChange={(event) => updateFilter(index, "operator", event.target.value)} disabled={isAudienceExclusionFilter}>
                        {isAudienceExclusionFilter ? (
                          <option value="in">not in audience</option>
                        ) : (
                          <>
                            <option value="equals">equals</option>
                            <option value="contains">contains</option>
                            <option value="in">in list</option>
                            <option value="not_equals">does not equal</option>
                          </>
                        )}
                      </select>
                      {filter.operator === "in" || isAudienceExclusionFilter ? (
                        <div className="multi-filter-box">
                          <div className="selected-filter-values">
                            {selectedValues.map((value) => (
                              <span className="filter-value-chip" key={value}>
                                {isAudienceExclusionFilter ? audienceListLabel(campaignAudienceLists, value) : value}
                                <button title={`Remove ${isAudienceExclusionFilter ? audienceListLabel(campaignAudienceLists, value) : value}`} onClick={() => removeFilterValue(index, value)} type="button">x</button>
                              </span>
                            ))}
                            {!selectedValues.length && <span className="empty-chip-hint">{isAudienceExclusionFilter ? "Select saved audiences to exclude" : "Select one or more values"}</span>}
                          </div>
                          <select value="" onFocus={() => loadAudienceFieldFacet(filter.field)} onChange={(event) => addFilterValue(index, event.target.value)} disabled={!availableQuickPicks.length && !fieldFacet?.loading}>
                            <option value="">
                              {fieldFacet?.loading
                                ? "Loading all suggestions..."
                                : availableQuickPicks.length
                                  ? (isAudienceExclusionFilter ? "Add saved audience..." : "Add suggested value...")
                                  : "No more suggestions"}
                            </option>
                            {availableQuickPicks.map((value) => (
                              <option key={value} value={value}>{isAudienceExclusionFilter ? audienceListLabel(campaignAudienceLists, value) : value}</option>
                            ))}
                          </select>
                          {!isAudienceExclusionFilter && (
                            <input
                              list={`quick-picks-${index}-${filter.field}`}
                              onFocus={() => loadAudienceFieldFacet(filter.field)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addFilterValue(index, event.currentTarget.value);
                                  event.currentTarget.value = "";
                                }
                              }}
                              onBlur={(event) => {
                                addFilterValue(index, event.currentTarget.value);
                                event.currentTarget.value = "";
                              }}
                              placeholder="Type custom value and press Enter"
                            />
                          )}
                        </div>
                      ) : (
                        <input list={`quick-picks-${index}-${filter.field}`} value={filter.value} onFocus={() => loadAudienceFieldFacet(filter.field)} onChange={(event) => updateFilter(index, "value", event.target.value)} placeholder="Value" />
                      )}
                      <datalist id={`quick-picks-${index}-${filter.field}`}>
                        {availableQuickPicks.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                      <button className="icon-button compact danger" title="Remove filter" onClick={() => removeFilter(index)}>
                        -
                      </button>
                      {!!availableQuickPicks.length && (
                        <div className="filter-quick-picks">
                          {availableQuickPicks.slice(0, 8).map((value) => (
                            <button key={value} className="secondary-button compact" onClick={() => filter.operator === "in" ? addFilterValue(index, value) : updateFilter(index, "value", value)}>
                              {isAudienceExclusionFilter ? audienceListLabel(campaignAudienceLists, value) : value}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="campaign-assignment-box embedded">
                <div>
                  <p className="eyebrow">Campaign assignment</p>
                  <h3>{selectedList.name}</h3>
                  <p>{filteredContacts.length} contacts currently visible</p>
                </div>
                <div className="campaign-assignment-options">
                  {campaigns.map((campaign) => {
                    const checked = (selectedList.associatedCampaignIds || []).includes(campaign.id);
                    return (
                      <label key={campaign.id} className={checked ? "selected" : ""}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setListCampaignAssociation(selectedList, campaign.id, event.target.checked)}
                        />
                        <span>
                          <strong>{campaign.shortName}</strong>
                          <small>
                            {checked
                              ? "Assigned to this audience"
                              : `${campaignAudienceLists.filter((list) => list.listId !== selectedList.listId && (list.associatedCampaignIds || []).includes(campaign.id)).length} other audience lists assigned`}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="existing-assignment-list">
                  <strong>Selected audience assignments</strong>
                  {selectedList.associatedCampaignIds?.length ? (
                    selectedList.associatedCampaignIds.map((id) => {
                      const campaign = campaigns.find((item) => item.id === id);
                      return (
                        <div key={id}>
                          <span>{campaign?.shortName || id}</span>
                          <small>{selectedList.name}</small>
                        </div>
                      );
                    })
                  ) : (
                    <p>This audience list is not assigned to any campaigns yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="audience-list-builder empty-state">
              <p>Select or create an audience list to filter imported contacts, freeze a send list, and assign it to campaigns.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel audience-contacts-panel">
        <div className="panel-head">
          <h3>Audience Contacts{selectedList ? ` - ${selectedList.name}` : ""}</h3>
          <div className="editor-actions">
            <button className="secondary-button compact" onClick={moveContactFirstPage} disabled={!campaignApiUrl || contactPageIndex === 0}>
              <ChevronLeft size={15} />
              First
            </button>
            <button className="secondary-button compact" onClick={() => moveContactPage(-1)} disabled={!campaignApiUrl || contactPageIndex === 0}>
              <ChevronLeft size={15} />
              Prev
            </button>
            <span className="page-readout">Page {contactPageIndex + 1}</span>
            <button className="secondary-button compact" onClick={() => moveContactPage(1)} disabled={!campaignApiUrl || !contactNextToken}>
              Next
              <ChevronRight size={15} />
            </button>
            <button className="secondary-button compact" onClick={moveContactLastPage} disabled={!campaignApiUrl || !contactNextToken}>
              Last
              <ChevronRight size={15} />
            </button>
            <label className="sort-control">
              <span>Show</span>
              <select value={contactPageSize} onChange={(event) => setContactPageSize(Number(event.target.value))}>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </label>
            <label className="sort-control">
              <span>Sort</span>
              <select value={audienceSortBy} onChange={(event) => setAudienceSortBy(event.target.value)}>
                <option value="name">Name</option>
                <option value="opens">Opens</option>
                <option value="clicks">Clicks</option>
                <option value="dialCode">Phone dial code</option>
                <option value="domain">Email domain</option>
                <option value="company">Company</option>
              </select>
            </label>
          </div>
        </div>
        <div className="audience-summary-row">
          <span>{audienceMatchCount === null ? "Counting matches..." : `${audienceMatchCount.toLocaleString()} match full list`}</span>
          <span>Showing {filteredContacts.length.toLocaleString()} contacts {pageStart}-{pageEnd} of {(contactResultCount || 0).toLocaleString()}</span>
          <span>Source list: {selectedSourceCount.toLocaleString()} contacts</span>
          {audienceMatchStatus && <span>{audienceMatchStatus}</span>}
          {contactLoadStatus && <span>{contactLoadStatus}</span>}
          <span>{sourceContacts.filter((contact) => compliance[emailKey(contact.email)]?.suppressed).length} suppressed</span>
          <span>{sourceContacts.reduce((sum, contact) => sum + (engagement[emailKey(contact.email)]?.opens || 0), 0)} opens</span>
          <span>{sourceContacts.reduce((sum, contact) => sum + (engagement[emailKey(contact.email)]?.clicks || 0), 0)} clicks</span>
        </div>
        {selectedList && selectedListSource && (
          <div className="bulk-update-bar">
            <div>
              <p className="eyebrow">Bulk update</p>
              <strong>Update filtered contacts</strong>
            </div>
            <label>
              <span>Field</span>
              <select value={bulkUpdateField} onChange={(event) => setBulkUpdateField(event.target.value)}>
                {bulkUpdatableAudienceFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Value</span>
              <input
                list={`bulk-values-${bulkUpdateField}`}
                value={bulkUpdateValue}
                onChange={(event) => setBulkUpdateValue(event.target.value)}
                placeholder="New value"
              />
              <datalist id={`bulk-values-${bulkUpdateField}`}>
                {quickPickValues(sourceContacts, bulkUpdateField).map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Apply to</span>
              <select value={bulkUpdateScope} onChange={(event) => setBulkUpdateScope(event.target.value)}>
                <option value="page">Visible filtered page ({filteredContacts.length.toLocaleString()})</option>
                <option value="all">All matching results ({audienceMatchCount === null ? "counting" : audienceMatchCount.toLocaleString()})</option>
              </select>
            </label>
            <button
              className="primary-button compact"
              onClick={runBulkContactUpdate}
              disabled={!campaignApiUrl || bulkUpdateBusy || !bulkUpdateValue.trim() || (bulkUpdateScope === "page" && !filteredContacts.length)}
            >
              <Save size={15} />
              {bulkUpdateBusy ? "Updating" : "Apply"}
            </button>
            {bulkUpdateStatus && <span className="bulk-update-status">{bulkUpdateStatus}</span>}
          </div>
        )}
        <div className="contact-table">
          <div className="contact-row heading">
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Fit</span>
            <span>Persona</span>
            <span>Status</span>
            <span>Results</span>
            <span>Actions</span>
          </div>
          {filteredContacts.map((contact) => {
            const contactCompliance = compliance[emailKey(contact.email)] || {};
            const contactEngagement = engagement[emailKey(contact.email)] || {};
            const rowStatusClass = contactCompliance.reason === "unsubscribed" ? "unsubscribed" : contactCompliance.reason === "bounced" ? "bounced" : "";
            const changedHubSpotFields = (dirtyContactFields[contact.contactId] || []).filter((field) => hubSpotSyncableContactFields.includes(field));
            const canSyncHubSpot = Boolean(campaignApiUrl && contact.hubspotRecordId && changedHubSpotFields.length && !syncingContactIds[contact.contactId]);
            return (
              <div className={`contact-row ${rowStatusClass}`} key={contact.contactId}>
                <span><input value={`${contact.firstName || ""} ${contact.lastName || ""}`.trim()} onChange={(event) => {
                  const [firstName, ...rest] = event.target.value.split(" ");
                  updateContact(contact.contactId, "firstName", firstName || "");
                  updateContact(contact.contactId, "lastName", rest.join(" "));
                }} /></span>
                <span><input value={contact.email || ""} onChange={(event) => updateContact(contact.contactId, "email", event.target.value)} /></span>
                <span><input value={contact.phone || ""} onChange={(event) => updateContact(contact.contactId, "phone", event.target.value)} /></span>
                <span>{contact.country || "No country"} · {contact.jobTitle || contact.persona || "No title"}</span>
                <span><input value={contact.persona || ""} onChange={(event) => updateContact(contact.contactId, "persona", event.target.value)} placeholder="Persona" /></span>
                <span className={contactCompliance.suppressed ? "contact-status suppressed" : "contact-status ok"}>{contactCompliance.reason || "sendable"}</span>
                <span>{contactEngagement.opens || 0} opens · {contactEngagement.clicks || 0} clicks</span>
                <span className="contact-actions">
                  <button className="icon-button compact" title="Save contact" onClick={() => saveContact(contact.contactId)}>
                    <Save size={14} />
                  </button>
                  <button
                    className={`icon-button compact ${changedHubSpotFields.length ? "sync-ready" : ""}`}
                    title={contact.hubspotRecordId ? (changedHubSpotFields.length ? `Sync ${changedHubSpotFields.join(", ")} to HubSpot` : "No HubSpot changes to sync") : "Contact is not linked to HubSpot"}
                    onClick={() => syncContactToHubSpot(contact)}
                    disabled={!canSyncHubSpot}
                  >
                    <PlugZap size={14} />
                  </button>
                  <button className="icon-button compact" title="Call in JustCall" onClick={() => window.open(justCallUrl(contact.phone), "_blank", "noopener,noreferrer")} disabled={!contact.phone}>
                    <Phone size={14} />
                  </button>
                  <button className="icon-button compact danger" title="Remove from list" onClick={() => removeContactFromList(contact)}>
                    <Trash2 size={14} />
                  </button>
                  {(contactSyncStatus[contact.contactId] || contact.hubspotSyncStatus) && (
                    <small className="contact-sync-state">{contactSyncStatus[contact.contactId] || contact.hubspotSyncStatus}</small>
                  )}
                </span>
              </div>
            );
          })}
          {!filteredContacts.length && (
            <div className="contact-empty-state">
              <strong>No contacts are visible for this audience list.</strong>
              <span>
                {contactLoadStatus ||
                  (audienceMatchCount === 0
                    ? "The selected filters currently match 0 contacts."
                    : "Contacts may still be loading, or this audience has no imported source contacts yet.")}
              </span>
            </div>
          )}
        </div>
        <div className="missing-company-panel">
          <div className="panel-head">
            <h3>Missing company coverage</h3>
            <small>Companies left without a sendable contact after bounces/unsubscribes</small>
          </div>
          {missingCompanies.length ? (
            <div className="missing-company-list">
              {missingCompanies.map((item) => (
                <span key={item.company}>{item.company} · {item.blocked} blocked · {item.reasons}</span>
              ))}
            </div>
          ) : (
            <p>No companies are currently missing a sendable contact in this audience.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function LeadNurtureWorkspace({
  activeCampaignId,
  audienceContacts,
  audienceLists,
  auth,
  authHeaders,
  campaignApiUrl,
  campaigns,
  contactEngagement,
  emailAssignments,
  emailEvents,
  integrationSettings,
  schedule,
  selectedAudienceListId,
  senderProfiles,
  setActiveCampaignId,
  setAudienceContacts,
  setContactEngagement,
  setSelectedAudienceListId,
  unsubscribers
}) {
  const reusableAudienceLists = audienceLists.filter((list) => list.sourceListId);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) || campaigns[0];
  const assignedLists = reusableAudienceLists.filter((list) => !selectedCampaign || (list.associatedCampaignIds || []).includes(selectedCampaign.id));
  const availableLists = assignedLists;
  const selectedList = availableLists.find((list) => list.listId === selectedAudienceListId) || availableLists[0] || null;
  const selectedSourceListId = selectedList?.sourceListId || selectedList?.listId || "";
  const compliance = buildComplianceIndex(unsubscribers, emailEvents);
  const engagement = buildEngagementIndex(contactEngagement, emailEvents);
  const justcall = integrationSettings.find((setting) => setting.settingKey === "justcall") || {};
  const hubspot = integrationSettings.find((setting) => setting.settingKey === "hubspot") || {};
  const ownerProfileById = Object.fromEntries(senderProfiles.map((profile) => [profile.ownerId, profile]));
  const loggedInOwner = senderProfiles.find((profile) => emailKey(profile.email) === emailKey(auth?.email));
  const [ownerFilter, setOwnerFilter] = useState(loggedInOwner?.ownerId || "all");
  const [statusFilter, setStatusFilter] = useState("due_late");
  const [taskFilter, setTaskFilter] = useState("next");
  const [search, setSearch] = useState("");
  const [selectedContactKey, setSelectedContactKey] = useState("");
  const [contactLoadStatus, setContactLoadStatus] = useState("");
  const [contactNextToken, setContactNextToken] = useState("");
  const [contactPageToken, setContactPageToken] = useState("");
  const [savingContactId, setSavingContactId] = useState("");
  const [leadDirtyContactFields, setLeadDirtyContactFields] = useState({});
  const leadSyncTimersRef = useRef({});

  useEffect(() => {
    if (availableLists.length && !availableLists.some((list) => list.listId === selectedAudienceListId)) {
      setSelectedAudienceListId(availableLists[0].listId);
      return;
    }
    if (!availableLists.length && selectedAudienceListId) setSelectedAudienceListId("");
  }, [selectedCampaign?.id, selectedAudienceListId, availableLists.map((list) => list.listId).join("|")]);

  useEffect(() => {
    if (!campaignApiUrl || !selectedSourceListId) return;
    let cancelled = false;
    fetchLeadNurtureContacts("", () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [
    campaignApiUrl,
    selectedSourceListId,
    selectedList?.listId,
    JSON.stringify(selectedList?.filters || []),
    JSON.stringify(selectedList?.excludedContactIds || []),
    JSON.stringify(selectedList?.frozenContactIds || []),
    selectedList?.frozen,
    authHeaders.Authorization
  ]);

  const callSteps = useMemo(() => {
    if (!selectedCampaign) return [];
    return selectedCampaign.events
      .filter(isLeadNurtureCallStep)
      .map((event) => ({
        campaign: selectedCampaign,
        event,
        key: eventKey(selectedCampaign, event),
        dueDate: dateFromPosition(schedule[eventKey(selectedCampaign, event)] || {})
      }))
      .filter((step) => step.dueDate);
  }, [selectedCampaign?.id, JSON.stringify(selectedCampaign?.events || []), schedule]);

  const ownerOptions = useMemo(() => {
    const campaignOwnerIds = new Set();
    if (selectedCampaign) {
      emailAssignments
        .filter((assignment) => assignment.campaignId === selectedCampaign.id)
        .flatMap((assignment) => Array.isArray(assignment.ownerIds) && assignment.ownerIds.length ? assignment.ownerIds : [assignment.owner])
        .filter(Boolean)
        .forEach((ownerId) => campaignOwnerIds.add(ownerId));
    }
    senderProfiles.forEach((profile) => {
      if (profile.ownerId) campaignOwnerIds.add(profile.ownerId);
    });
    return Array.from(campaignOwnerIds);
  }, [emailAssignments, selectedCampaign?.id, senderProfiles]);

  const sourceContacts = audienceContacts.filter((contact) => contact.listId === selectedSourceListId);
  const audienceExclusionEmails = buildAudienceExclusionEmails(selectedList?.filters || [], audienceLists, audienceContacts, compliance);
  const listContacts = selectedList?.frozen
    ? sourceContacts.filter((contact) => (selectedList.frozenContactIds || []).includes(contact.contactId))
    : applyAudienceFilters(sourceContacts, selectedList?.filters || [], compliance, { audienceExclusionEmails });
  const visibleContacts = listContacts.filter((contact) => !(selectedList?.excludedContactIds || []).includes(contact.contactId));

  const leadRows = visibleContacts.map((contact) => buildLeadNurtureRow({
    campaign: selectedCampaign,
    callSteps,
    contact,
    contactEngagement,
    emailAssignments,
    ownerProfileById,
    senderProfiles
  }));

  const filteredRows = leadRows
    .filter((row) => ownerFilter === "all" || row.ownerId === ownerFilter)
    .filter((row) => statusMatchesLeadFilter(row, statusFilter))
    .filter((row) => {
      if (taskFilter === "next") return true;
      return row.step?.event?.id === taskFilter;
    })
    .filter((row) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [row.contact.firstName, row.contact.lastName, row.contact.email, row.contact.company, row.contact.jobTitle, row.contact.phone]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

  const selectedRow = filteredRows.find((row) => leadContactKey(row.contact) === selectedContactKey) || filteredRows[0] || null;
  const selectedRecord = selectedRow ? leadCallRecord(contactEngagement, selectedRow.contact.contactId, selectedCampaign?.id, selectedRow.step?.event?.id) : null;
  const dashboardCounts = leadRows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.statusId] = (acc[row.statusId] || 0) + 1;
      if (!row.contact.phone) acc.missingPhone += 1;
      return acc;
    },
    { total: 0, upcoming: 0, due_today: 0, late: 0, complete: 0, deferred: 0, skipped: 0, missingPhone: 0 }
  );

  async function fetchLeadNurtureContacts(pageToken = "", cancelled = () => false) {
    if (!campaignApiUrl || !selectedSourceListId) return;
    setContactLoadStatus("Loading Lead Nurture contacts...");
    try {
      const params = new URLSearchParams({
        limit: "100",
        ...(selectedList?.listId ? { audienceListId: selectedList.listId } : { listId: selectedSourceListId })
      });
      if (pageToken) params.set("nextToken", pageToken);
      const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Contact load failed: ${response.status}`);
      if (cancelled()) return;
      const contacts = result.contacts || [];
      setAudienceContacts((current) => [...current.filter((contact) => contact.listId !== selectedSourceListId), ...contacts]);
      setContactNextToken(result.nextToken || "");
      setContactPageToken(pageToken || "");
      setContactLoadStatus(`Loaded ${contacts.length.toLocaleString()} contacts for this working page.`);
    } catch (error) {
      if (!cancelled()) setContactLoadStatus(error.message);
    }
  }

  async function syncLeadCallToHubSpot(record, contact) {
    if (!campaignApiUrl || !record?.eventId || !contact?.contactId) return;
    setContactEngagement((current) => current.map((item) =>
      item.eventId === record.eventId
        ? { ...item, hubspotSyncStatus: "syncing", hubspotSyncError: "" }
        : item
    ));
    try {
      const response = await fetch(`${campaignApiUrl}/hubspot/sync-lead-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          contact,
          engagement: record,
          ownerProfile: ownerProfileById[record.ownerId] || null
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HubSpot sync failed: ${response.status}`);
      const updated = result.engagement || record;
      setContactEngagement((current) => current.map((item) =>
        item.eventId === updated.eventId ? { ...item, ...updated } : item
      ));
    } catch (error) {
      setContactEngagement((current) => current.map((item) =>
        item.eventId === record.eventId
          ? {
            ...item,
            hubspotSyncStatus: "error",
            hubspotSyncError: error.message,
            hubspotTaskStatus: record.callbackAt ? "error" : item.hubspotTaskStatus,
            hubspotTaskError: record.callbackAt ? error.message : item.hubspotTaskError
          }
          : item
      ));
    }
  }

  function queueLeadCallSync(record, contact, delayMs = 900) {
    if (!record?.eventId) return;
    window.clearTimeout(leadSyncTimersRef.current[record.eventId]);
    leadSyncTimersRef.current[record.eventId] = window.setTimeout(() => {
      syncLeadCallToHubSpot(record, contact);
    }, delayMs);
  }

  function upsertLeadCall(contact, step, patch, options = {}) {
    if (!selectedCampaign || !contact?.contactId || !step?.event?.id) return;
    const eventId = leadCallEventId(contact.contactId, selectedCampaign.id, step.event.id);
    const now = nowIso();
    const existingRecord = contactEngagement.find((item) => item.eventId === eventId);
    const nextRecord = {
      ...(existingRecord || {}),
      eventId,
      contactId: contact.contactId,
      email: emailKey(contact.email),
      campaignId: selectedCampaign.id,
      campaignName: selectedCampaign.shortName || selectedCampaign.name,
      taskId: step.event.id,
      taskTitle: step.event.title || channelMeta[step.event.type]?.label || "Call",
      dueDate: dateToInputValue(step.dueDate),
      eventType: "LeadCall",
      ownerId: assignedOwnerIdForContact(contact, selectedCampaign, emailAssignments, senderProfiles),
      eventAt: existingRecord?.eventAt || now,
      updatedAt: now,
      ...patch
    };
    setContactEngagement((current) => {
      const existing = current.find((item) => item.eventId === eventId);
      return existing
        ? current.map((item) => (item.eventId === eventId ? nextRecord : item))
        : [nextRecord, ...current];
    });
    if (options.sync !== false) queueLeadCallSync(nextRecord, contact, options.delayMs ?? 900);
    return nextRecord;
  }

  function updateSelectedNote(value) {
    if (!selectedRow?.step) return;
    upsertLeadCall(selectedRow.contact, selectedRow.step, { notes: value, hubspotSyncStatus: "pending" }, { delayMs: 1400 });
  }

  function updateSelectedOutcome(value) {
    if (!selectedRow?.step) return;
    if (value === "Voicemail") {
      const callbackAt = nextBusinessCallDatetime(selectedRow.dueDate);
      upsertLeadCall(selectedRow.contact, selectedRow.step, {
        outcome: value,
        status: "deferred",
        callbackAt,
        nextAction: `Call back ${formatDateTime(callbackAt)}`,
        hubspotTaskStatus: "pending",
        hubspotSyncStatus: "pending"
      }, { delayMs: 0 });
      return;
    }
    const status = skippedCallOutcomes.has(value) ? "skipped" : completedCallOutcomes.has(value) ? "complete" : "wip";
    upsertLeadCall(selectedRow.contact, selectedRow.step, {
      outcome: value,
      status,
      completedAt: completedCallOutcomes.has(value) ? nowIso() : "",
      hubspotSyncStatus: "pending"
    }, { delayMs: 0 });
  }

  function updateCallbackAt(value) {
    if (!selectedRow?.step) return;
    upsertLeadCall(selectedRow.contact, selectedRow.step, {
      outcome: "Callback requested",
      status: "deferred",
      callbackAt: value,
      nextAction: value ? `Call back ${formatDateTime(value)}` : "Call back requested",
      hubspotTaskStatus: "pending",
      hubspotSyncStatus: "pending"
    }, { delayMs: 0 });
  }

  function launchSelectedCall() {
    if (!selectedRow?.contact?.phone || !selectedRow?.step) return;
    upsertLeadCall(selectedRow.contact, selectedRow.step, {
      status: "wip",
      outcome: selectedRecord?.outcome || "Connected",
      callStartedAt: nowIso(),
      justcallDialerMode: "desktop_app",
      hubspotSyncStatus: "pending"
    }, { delayMs: 0 });
    window.location.href = justCallDesktopUrl(selectedRow.contact.phone);
  }

  function launchSelectedWebDialer() {
    if (!selectedRow?.contact?.phone || !selectedRow?.step) return;
    const metadata = {
      source: "CloudCamp",
      marker: "LNCC",
      campaignId: selectedCampaign.id,
      campaignName: selectedCampaign.shortName || selectedCampaign.name,
      contactId: selectedRow.contact.contactId,
      taskId: selectedRow.step.event.id,
      audienceListId: selectedList?.listId || ""
    };
    upsertLeadCall(selectedRow.contact, selectedRow.step, {
      status: "wip",
      outcome: selectedRecord?.outcome || "Connected",
      callStartedAt: nowIso(),
      justcallDialerMode: "web_dialer",
      hubspotSyncStatus: "pending"
    }, { delayMs: 0 });
    window.open(justCallUrl(selectedRow.contact.phone, metadata), "justcallDialer", "popup=yes,width=385,height=665,noopener,noreferrer");
  }

  function openSelectedHubSpotRecord() {
    const url = hubSpotContactRecordUrl(selectedRow?.contact, hubspot.portalId);
    if (!url) return;
    window.open(url, "hubspotContact", "noopener,noreferrer");
  }

  async function saveSelectedContact() {
    if (!selectedRow?.contact || !campaignApiUrl) return;
    setSavingContactId(selectedRow.contact.contactId);
    const dirtyFields = (leadDirtyContactFields[selectedRow.contact.contactId] || []).filter((field) => hubSpotSyncableContactFields.includes(field));
    try {
      const response = await fetch(`${campaignApiUrl}/audience-contacts`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify(selectedRow.contact)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Contact save failed: ${response.status}`);
      const updated = result.contact || selectedRow.contact;
      setAudienceContacts((current) => current.map((contact) =>
        contact.contactId === updated.contactId && contact.listId === updated.listId ? updated : contact
      ));
      let finalContact = updated;
      if (updated.hubspotRecordId && dirtyFields.length) {
        const hubspotResponse = await fetch(`${campaignApiUrl}/hubspot/sync-contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            contact: updated,
            fields: dirtyFields
          })
        });
        const hubspotResult = await hubspotResponse.json();
        if (!hubspotResponse.ok) throw new Error(hubspotResult.message || `HubSpot contact sync failed: ${hubspotResponse.status}`);
        finalContact = hubspotResult.contact || updated;
        setLeadDirtyContactFields((current) => {
          const next = { ...current };
          delete next[selectedRow.contact.contactId];
          return next;
        });
      }
      setAudienceContacts((current) => current.map((contact) =>
        contact.contactId === finalContact.contactId && contact.listId === finalContact.listId ? finalContact : contact
      ));
      if (selectedRow.step) upsertLeadCall(finalContact, selectedRow.step, { contactUpdatedAt: nowIso(), hubspotSyncStatus: dirtyFields.length ? "synced" : "pending" }, { delayMs: 0 });
    } catch (error) {
      if (selectedRow.step) upsertLeadCall(selectedRow.contact, selectedRow.step, { lastSaveError: error.message });
    } finally {
      setSavingContactId("");
    }
  }

  function updateSelectedContactField(field, value) {
    if (!selectedRow?.contact) return;
    const contactId = selectedRow.contact.contactId;
    setAudienceContacts((current) => current.map((contact) =>
      contact.contactId === contactId && contact.listId === selectedRow.contact.listId
        ? { ...contact, [field]: field === "email" ? String(value || "").toLowerCase() : value }
        : contact
    ));
    if (hubSpotSyncableContactFields.includes(field)) {
      setLeadDirtyContactFields((current) => ({
        ...current,
        [contactId]: Array.from(new Set([...(current[contactId] || []), field]))
      }));
    }
  }

  return (
    <div className="lead-nurture-page">
      <section className="lead-nurture-hero">
        <div>
          <p className="eyebrow">Live calling workspace</p>
          <h2>Lead Nurture</h2>
          <span>{contactLoadStatus || "Work campaign calls from reusable audience lists."}</span>
        </div>
        <div className="lead-kpis">
          <Metric title="Due today" value={dashboardCounts.due_today || 0} note="Campaign call steps" icon={Phone} />
          <Metric title="Late" value={dashboardCounts.late || 0} note="Needs attention" icon={PauseCircle} />
          <Metric title="Callbacks" value={dashboardCounts.deferred || 0} note="Deferred with date/time" icon={CalendarDays} />
          <Metric title="Done / skipped" value={(dashboardCounts.complete || 0) + (dashboardCounts.skipped || 0)} note={`${dashboardCounts.missingPhone || 0} missing phone`} icon={CheckCircle2} />
        </div>
      </section>

      <section className="panel lead-filter-panel">
        <label>
          <span>Campaign</span>
          <select value={selectedCampaign?.id || ""} onChange={(event) => setActiveCampaignId(event.target.value)}>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.shortName || campaign.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Audience list</span>
          <select value={selectedList?.listId || ""} onChange={(event) => setSelectedAudienceListId(event.target.value)} disabled={!availableLists.length}>
            {!availableLists.length && <option value="">No audience assigned to this campaign</option>}
            {availableLists.map((list) => (
              <option key={list.listId} value={list.listId}>{list.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Owner</span>
          <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            <option value="all">All owners</option>
            {ownerOptions.map((ownerId) => (
              <option key={ownerId} value={ownerId}>{ownerProfileById[ownerId]?.name || ownerId}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Call step</span>
          <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
            <option value="next">Next due call</option>
            {callSteps.map((step) => (
              <option key={step.event.id} value={step.event.id}>{step.event.title || step.event.label || "Call"} - {formatDate(step.dueDate)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="due_late">Due and late</option>
            <option value="all">All statuses</option>
            <option value="upcoming">Upcoming - next 5 days</option>
            <option value="due_today">Due today</option>
            <option value="late">Late</option>
            <option value="deferred">Callback</option>
            <option value="complete">Complete</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>
        <label>
          <span>Search</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, company, email, phone" />
        </label>
        <div className="lead-filter-actions">
          <button className="secondary-button compact" onClick={() => fetchLeadNurtureContacts("")} disabled={!campaignApiUrl || !selectedSourceListId}>
            <RotateCcw size={15} />
            Refresh
          </button>
          <button className="secondary-button compact" onClick={() => fetchLeadNurtureContacts(contactNextToken)} disabled={!campaignApiUrl || !contactNextToken}>
            Next 100
            <ChevronRight size={15} />
          </button>
        </div>
      </section>

      <section className="panel lead-table-panel">
        <div className="panel-head">
          <h3>{filteredRows.length.toLocaleString()} contacts in view</h3>
          <span>{callSteps.length ? `${callSteps.length} campaign call step${callSteps.length === 1 ? "" : "s"}` : "No call steps on this campaign yet"}</span>
        </div>
        <div className="lead-scroll-table">
          <div className="lead-row lead-heading">
            <span className="lead-sticky lead-contact-cell">Contact</span>
            <span>Company</span>
            <span>Owner</span>
            <span>Next call</span>
            <span>Status</span>
            <span>Outcome</span>
            <span>Phone</span>
            <span>Email</span>
            <span>Persona</span>
            <span>Title</span>
            <span>Opens</span>
            <span>Clicks</span>
            <span>Notes</span>
            <span>Actions</span>
          </div>
          {filteredRows.map((row) => {
            const contactKey = leadContactKey(row.contact);
            const contactEngagement = engagement[emailKey(row.contact.email)] || {};
            return (
              <button
                className={`lead-row ${row.statusId} ${contactKey === selectedContactKey ? "selected" : ""}`}
                key={contactKey}
                onClick={() => setSelectedContactKey(contactKey)}
              >
                <span className="lead-sticky lead-contact-cell">
                  <strong>{contactName(row.contact)}</strong>
                  <small>{row.contact.email || "No email"}</small>
                </span>
                <span>{row.contact.company || "No company"}</span>
                <span>{ownerProfileById[row.ownerId]?.name || row.ownerId || "Unassigned"}</span>
                <span>{row.step ? `${row.step.event.title || "Call"} · ${formatDate(row.dueDate)}` : "No call step"}</span>
                <span><span className={`lead-status ${row.statusId}`}>{row.statusLabel}</span></span>
                <span>{row.record?.outcome || "-"}</span>
                <span>{row.contact.phone || "No phone"}</span>
                <span>{row.contact.email || "No email"}</span>
                <span>{row.contact.persona || "-"}</span>
                <span>{row.contact.jobTitle || "-"}</span>
                <span>{contactEngagement.opens || 0}</span>
                <span>{contactEngagement.clicks || 0}</span>
                <span>{row.record?.notes || "-"}</span>
                <span className="lead-row-actions">
                  <Phone size={14} />
                  <span>{row.contact.phone ? "Open" : "Missing"}</span>
                </span>
              </button>
            );
          })}
          {!filteredRows.length && (
            <div className="lead-empty-state">
              <strong>No contacts match this Lead Nurture view.</strong>
              <span>Try All statuses, another owner, or refresh the selected audience list.</span>
            </div>
          )}
        </div>
      </section>

      {selectedRow && (
        <aside className="panel lead-call-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Live call panel</p>
              <h2>{contactName(selectedRow.contact)}</h2>
            </div>
            <span className={`lead-status ${selectedRow.statusId}`}>{selectedRow.statusLabel}</span>
          </div>
          <div className="lead-call-grid">
            <label>
              <span>Company</span>
              <input value={selectedRow.contact.company || ""} onChange={(event) => updateSelectedContactField("company", event.target.value)} />
            </label>
            <label>
              <span>Job title</span>
              <input value={selectedRow.contact.jobTitle || ""} onChange={(event) => updateSelectedContactField("jobTitle", event.target.value)} />
            </label>
            <label>
              <span>Phone</span>
              <input value={selectedRow.contact.phone || ""} onChange={(event) => updateSelectedContactField("phone", event.target.value)} />
            </label>
            <label>
              <span>Persona</span>
              <input value={selectedRow.contact.persona || ""} onChange={(event) => updateSelectedContactField("persona", event.target.value)} />
            </label>
            <label>
              <span>Campaign step</span>
              <input value={selectedRow.step?.event?.title || "No call step"} readOnly />
            </label>
            <label>
              <span>Due date</span>
              <input value={selectedRow.dueDate ? formatDate(selectedRow.dueDate) : "No date"} readOnly />
            </label>
            <label>
              <span>Outcome</span>
              <select value={selectedRecord?.outcome || ""} onChange={(event) => updateSelectedOutcome(event.target.value)} disabled={!selectedRow.step}>
                <option value="">Select outcome...</option>
                {callOutcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>{outcome}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Callback date/time</span>
              <input type="datetime-local" value={toDatetimeLocalValue(selectedRecord?.callbackAt)} onChange={(event) => updateCallbackAt(event.target.value)} disabled={!selectedRow.step} />
            </label>
            <label className="wide-field">
              <span>Call notes</span>
              <textarea value={selectedRecord?.notes || ""} onChange={(event) => updateSelectedNote(event.target.value)} placeholder="Autosaves and syncs to HubSpot with the LNCC marker." />
            </label>
          </div>
          <div className="lead-call-actions">
            <button className="primary-button" onClick={launchSelectedCall} disabled={!selectedRow.contact.phone || !selectedRow.step}>
              <Phone size={16} />
              Call with JustCall App
            </button>
            <button className="secondary-button lead-web-dialer-button" onClick={launchSelectedWebDialer} disabled={!selectedRow.contact.phone || !selectedRow.step}>
              <Phone size={16} />
              Web dialer
            </button>
            <button className="secondary-button lead-hubspot-button" onClick={openSelectedHubSpotRecord} disabled={!hubSpotContactRecordUrl(selectedRow.contact, hubspot.portalId)} title={selectedRow.contact.hubspotRecordId ? "Open this contact in HubSpot" : "Contact is not linked to HubSpot"}>
              <ExternalLink size={16} />
              Open in HS
            </button>
            <button className="secondary-button" onClick={saveSelectedContact} disabled={!campaignApiUrl || savingContactId === selectedRow.contact.contactId}>
              <Save size={16} />
              {savingContactId === selectedRow.contact.contactId
                ? "Saving"
                : selectedRow.contact.hubspotRecordId && (leadDirtyContactFields[selectedRow.contact.contactId] || []).some((field) => hubSpotSyncableContactFields.includes(field))
                  ? "Save + sync HS"
                  : "Save contact"}
            </button>
            <span>{leadHubSpotSyncLabel(selectedRecord)}</span>
          </div>
          <div className="lncc-preview">
            <strong>LNCC note marker</strong>
            <span>{buildLnccPreview(selectedCampaign, selectedRow, selectedRecord)}</span>
          </div>
        </aside>
      )}
    </div>
  );
}

function SendReviewWorkspace({ activeCampaignId, authHeaders, campaignApiUrl, campaigns, setActiveCampaignId }) {
  const [campaignFilter, setCampaignFilter] = useState(activeCampaignId || "all");
  const [sendRuns, setSendRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedDetails, setSelectedDetails] = useState({ sendRun: null, sendRecords: [] });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewActionLoading, setReviewActionLoading] = useState("");
  const [error, setError] = useState("");
  const selectedRun = selectedDetails.sendRun?.sendRunId === selectedRunId
    ? selectedDetails.sendRun
    : sendRuns.find((run) => run.sendRunId === selectedRunId) || sendRuns[0] || null;
  const sendRecords = selectedDetails.sendRun?.sendRunId === selectedRunId ? selectedDetails.sendRecords || [] : [];
  const counts = selectedRun?.counts || {};
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedRun?.campaignId);

  useEffect(() => {
    setCampaignFilter((current) => current || activeCampaignId || "all");
  }, [activeCampaignId]);

  useEffect(() => {
    fetchSendRuns();
  }, [campaignFilter, authHeaders?.Authorization, campaignApiUrl]);

  useEffect(() => {
    if (!selectedRunId && sendRuns[0]?.sendRunId) {
      setSelectedRunId(sendRuns[0].sendRunId);
      return;
    }
    if (selectedRunId) fetchSendRunDetails(selectedRunId);
  }, [selectedRunId, authHeaders?.Authorization, campaignApiUrl]);

  async function fetchSendRuns() {
    if (!campaignApiUrl) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "75" });
      if (campaignFilter && campaignFilter !== "all") params.set("campaignId", campaignFilter);
      const response = await fetch(`${campaignApiUrl}/send-runs?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Review run load failed: ${response.status}`);
      const runs = result.sendRuns || [];
      setSendRuns(runs);
      setSelectedRunId((current) => runs.some((run) => run.sendRunId === current) ? current : runs[0]?.sendRunId || "");
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSendRunDetails(sendRunId) {
    if (!campaignApiUrl || !sendRunId) return;
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ sendRunId, limit: "1000" });
      const response = await fetch(`${campaignApiUrl}/send-runs?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Review detail load failed: ${response.status}`);
      setSelectedDetails({ sendRun: result.sendRun, sendRecords: result.sendRecords || [] });
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function changeCampaignFilter(value) {
    setCampaignFilter(value);
    if (value !== "all") setActiveCampaignId(value);
  }

  function runStatusLabel(status = "") {
    if (status === "review_required") return "Review required";
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "sending") return "Sending";
    if (status === "partially_sent") return "Partially sent";
    if (status === "sent_with_failures") return "Sent with failures";
    if (status === "sent") return "Sent";
    return status || "Unknown";
  }

  function approveActionLocked(run = {}) {
    return ["approved", "sending", "partially_sent", "sent_with_failures", "sent", "rejected"].includes(run.status);
  }

  function rejectActionLocked(run = {}) {
    return ["rejected", "sending", "partially_sent", "sent_with_failures", "sent"].includes(run.status) || Number(run.sentCount || 0) > 0;
  }

  function rescheduleLocked(run = {}) {
    return ["rejected", "sent", "sending"].includes(run.status);
  }

  function sendActionEnabled(run = {}) {
    return run.mode !== "calendar_auto" && ["approved", "partially_sent", "sent_with_failures"].includes(run.status);
  }

  function sendActionLabel(run = {}) {
    if (reviewActionLoading === "send") return "Sending";
    if (run.mode === "calendar_auto") return "Waits for calendar window";
    if (run.status === "partially_sent") return "Continue send";
    return "Send approved run";
  }

  function sendSlotLabel(run = {}) {
    return [
      run.sendDate || "No date",
      run.sendWindow || "No window",
      run.timezone || "No timezone"
    ].join(" · ");
  }

  function sendRunCardClass(run = {}) {
    const classes = [];
    if (run.sendRunId === selectedRunId) classes.push("selected");
    if (run.status === "rejected") classes.push("rejected");
    if (["approved", "sending", "partially_sent", "sent_with_failures", "sent"].includes(run.status)) classes.push("processed");
    return classes.join(" ");
  }

  function campaignStyleForRun(run = {}) {
    const campaign = campaigns.find((item) => item.id === run.campaignId);
    return {
      "--campaign": campaign?.color || "var(--cw-green-deep)",
      "--campaign-bg": campaign?.bg || "color-mix(in srgb, var(--cw-green) 12%, #fff)",
      "--campaign-text": campaign?.textColor || "var(--cw-ink)"
    };
  }

  async function updateRunReview(action) {
    if (!campaignApiUrl || !selectedRun?.sendRunId) return;
    const reason = action === "reject" ? window.prompt("Optional rejection reason", selectedRun.rejectionReason || "") || "" : "";
    setReviewActionLoading(action);
    setError("");
    try {
      const response = await fetch(`${campaignApiUrl}/send-runs`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          action,
          reason,
          sendRunId: selectedRun.sendRunId
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Review update failed: ${response.status}`);
      setSelectedDetails((current) => ({
        ...current,
        sendRun: result.sendRun
      }));
      setSendRuns((current) => current.map((run) => run.sendRunId === result.sendRun.sendRunId ? result.sendRun : run));
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setReviewActionLoading("");
    }
  }

  async function rescheduleRun() {
    if (!campaignApiUrl || !selectedRun?.sendRunId) return;
    const sendDate = window.prompt("New send date (YYYY-MM-DD)", selectedRun.sendDate || tomorrowInputDate());
    if (!sendDate) return;
    const sendWindow = window.prompt("New send window", selectedRun.sendWindow || "09:00-11:00");
    if (!sendWindow) return;
    const timezone = window.prompt("Timezone", selectedRun.timezone || userTimezone());
    if (!timezone) return;
    setReviewActionLoading("reschedule");
    setError("");
    try {
      const response = await fetch(`${campaignApiUrl}/send-runs`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          action: "reschedule",
          sendDate,
          sendRunId: selectedRun.sendRunId,
          sendWindow,
          timezone
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Reschedule failed: ${response.status}`);
      setSelectedDetails((current) => ({ ...current, sendRun: result.sendRun }));
      setSendRuns((current) => current.map((run) => run.sendRunId === result.sendRun.sendRunId ? result.sendRun : run));
    } catch (rescheduleError) {
      setError(rescheduleError.message);
    } finally {
      setReviewActionLoading("");
    }
  }

  async function sendApprovedRun() {
    if (!campaignApiUrl || !selectedRun?.sendRunId || !sendActionEnabled(selectedRun)) return;
    const confirmation = window.prompt("Type SEND to manually send up to 50 queued emails from this approved run.", "");
    if (confirmation !== "SEND") return;
    setReviewActionLoading("send");
    setError("");
    try {
      const response = await fetch(`${campaignApiUrl}/send-runs`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          action: "send",
          sendRunId: selectedRun.sendRunId
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Manual send failed: ${response.status}`);
      setSelectedDetails((current) => ({ ...current, sendRun: result.sendRun }));
      setSendRuns((current) => current.map((run) => run.sendRunId === result.sendRun.sendRunId ? result.sendRun : run));
      await fetchSendRunDetails(result.sendRun.sendRunId);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setReviewActionLoading("");
    }
  }

  return (
    <div className="send-review-workspace">
      <section className="panel send-review-list-panel">
        <div className="panel-head">
          <h3>Review runs</h3>
          <button className="icon-button compact" title="Refresh review runs" onClick={fetchSendRuns} disabled={loading}>
            <RotateCcw size={15} />
          </button>
        </div>
        <label className="email-library-filter">
          <span>Campaign</span>
          <select value={campaignFilter} onChange={(event) => changeCampaignFilter(event.target.value)}>
            <option value="all">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
            ))}
          </select>
        </label>
        <div className="send-run-list">
          {sendRuns.map((run) => (
            <button
              key={run.sendRunId}
              className={sendRunCardClass(run)}
              style={campaignStyleForRun(run)}
              onClick={() => setSelectedRunId(run.sendRunId)}
            >
              <strong>{run.emailLabel || run.subject || run.emailId}</strong>
              <span>{run.audienceListName || run.audienceListId}</span>
              <small>{runStatusLabel(run.status)} · {Number(run.counts?.eligible || 0).toLocaleString()} queued · {sendSlotLabel(run)}</small>
            </button>
          ))}
          {!sendRuns.length && <p className="empty-library-note">{loading ? "Loading review runs..." : "No review runs yet. Create one from an Emails campaign mapping."}</p>}
          {error && <p className="send-review-error">{error}</p>}
        </div>
      </section>

      <section className="panel send-review-detail-panel">
        {selectedRun ? (
          <>
            <div className="section-head">
              <div>
                <p className="eyebrow">Send review</p>
                <h2>{selectedRun.emailLabel || selectedRun.subject || selectedRun.emailId}</h2>
              </div>
              <div className="send-review-actions">
                <span className={`send-review-status ${selectedRun.status || "review_required"}`}>{runStatusLabel(selectedRun.status)}</span>
                <button className="secondary-button compact danger-outline" onClick={() => updateRunReview("reject")} disabled={Boolean(reviewActionLoading) || rejectActionLocked(selectedRun)}>
                  <X size={15} />
                  {reviewActionLoading === "reject" ? "Rejecting" : "Reject"}
                </button>
                <button className="secondary-button compact" onClick={rescheduleRun} disabled={Boolean(reviewActionLoading) || rescheduleLocked(selectedRun)}>
                  <CalendarDays size={15} />
                  {reviewActionLoading === "reschedule" ? "Rescheduling" : "Reschedule"}
                </button>
                <button className="primary-button compact" onClick={() => updateRunReview("approve")} disabled={Boolean(reviewActionLoading) || approveActionLocked(selectedRun)}>
                  <CheckCircle2 size={15} />
                  {reviewActionLoading === "approve" ? "Approving" : approveActionLocked(selectedRun) && selectedRun.status !== "rejected" ? "Approved" : "Approve"}
                </button>
                <button className="primary-button compact send-now-button" onClick={sendApprovedRun} disabled={Boolean(reviewActionLoading) || !sendActionEnabled(selectedRun)}>
                  <PlayCircle size={15} />
                  {sendActionLabel(selectedRun)}
                </button>
              </div>
            </div>
            {selectedRun.rejectionReason && (
              <div className="send-review-rejection">
                <strong>Rejected reason</strong>
                <span>{selectedRun.rejectionReason}</span>
              </div>
            )}
            <div className="send-review-summary">
              <div>
                <span>Total audience</span>
                <strong>{Number(counts.totalContacts || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>Queued to send</span>
                <strong>{Number(counts.eligible || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>Skipped</span>
                <strong>{Number(counts.skipped || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>Recipient records</span>
                <strong>{Number(selectedRun.recordsSaved || sendRecords.length || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>Sent / failed</span>
                <strong>{Number(selectedRun.sentCount || 0).toLocaleString()} / {Number(selectedRun.failedCount || 0).toLocaleString()}</strong>
              </div>
            </div>
            <div className="send-review-meta-grid">
              <article className="campaign-meta-card" style={campaignStyleForRun(selectedRun)}>
                <span>Campaign</span>
                <strong>{selectedCampaign?.shortName || selectedRun.campaignId}</strong>
                <small>{selectedRun.stepKey} · {selectedRun.mode || "manual_review"}</small>
              </article>
              <article>
                <span>Scheduled slot</span>
                <strong>{sendSlotLabel(selectedRun)}</strong>
                <small>{selectedRun.rescheduledAt ? `Rescheduled ${formatDateTime(selectedRun.rescheduledAt)}` : `Created ${formatDateTime(selectedRun.createdAt)}`}</small>
              </article>
              <article>
                <span>Audience</span>
                <strong>{selectedRun.audienceListName || selectedRun.audienceListId}</strong>
                <small>{selectedRun.recordLimitApplied ? "Recipient rows capped for review; counts cover full audience." : "Recipient rows are stored for this review run."}</small>
              </article>
              <article>
                <span>Skipped reasons</span>
                <strong>{Object.entries(counts.bySkipReason || {}).map(([reason, value]) => `${reason}: ${value}`).join(" · ") || "None"}</strong>
                <small>Suppression comes from unsubscribe, bounce, complaint, duplicate, and sender checks.</small>
              </article>
              <article>
                <span>Sender split</span>
                <strong>{Object.entries(counts.byOwner || {}).map(([owner, value]) => `${owner}: ${value}`).join(" · ") || "No queued senders"}</strong>
                <small>Current split is calculated from assignment owners.</small>
              </article>
            </div>
            {!!selectedRun.previewRecipients?.length && (
              <div className="send-review-preview">
                <div className="panel-head">
                  <h3>Rendered samples</h3>
                  <span>{selectedRun.previewRecipients.length} stored</span>
                </div>
                {selectedRun.previewRecipients.map((recipient) => (
                  <article key={`${selectedRun.sendRunId}-${recipient.email}`}>
                    <span>{recipient.email} · {recipient.senderName || recipient.ownerId}</span>
                    <strong>{recipient.subject}</strong>
                    <p>{recipient.bodyText}</p>
                  </article>
                ))}
              </div>
            )}
            <div className="send-review-records">
              <div className="panel-head">
                <h3>Recipient records</h3>
                <span>{detailLoading ? "Loading..." : `${sendRecords.length.toLocaleString()} visible`}</span>
              </div>
              <div className="send-review-table">
                <div className="send-review-row heading">
                  <span>Status</span>
                  <span>Recipient</span>
                  <span>Company</span>
                  <span>Sender</span>
                  <span>Reason</span>
                  <span>Tracking link</span>
                </div>
                {sendRecords.map((record) => (
                  <div className={`send-review-row ${record.status}`} key={`${record.sendRunId}-${record.recipientEmail}`}>
                    <span>{record.status}</span>
                    <span>
                      <strong>{record.recipientName || record.recipientEmail}</strong>
                      <small>{record.recipientEmail}</small>
                    </span>
                    <span>{record.company || "-"}</span>
                    <span>{record.senderName || record.ownerId || "-"}</span>
                    <span>{record.skipReason || "-"}</span>
                    <span>{record.websiteLink ? <a href={record.websiteLink} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Link</a> : "-"}</span>
                  </div>
                ))}
                {!sendRecords.length && <p className="empty-library-note">No recipient records loaded for this run yet.</p>}
              </div>
            </div>
          </>
        ) : (
          <div className="send-review-empty">
            <p className="eyebrow">Send review</p>
            <h2>No review run selected</h2>
            <p>Create a review run from the Emails page, then return here to inspect the plan before any test send.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function WhatsAppWorkspace({ audienceLists, authHeaders, campaignApiUrl, campaigns, createCampaignComponent, integrationSettings = [], senderProfiles, templates, setDeletedContentAssetIds, setTemplates }) {
  const [selectedAssetId, setSelectedAssetId] = useState(() => templates[0]?.assetId || initialWhatsAppTemplates[0]?.assetId);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [manualSendStatus, setManualSendStatus] = useState("");
  const [testContact, setTestContact] = useState({
    firstName: "there",
    phone: "",
    senderOwnerId: ""
  });
  const selectedTemplate = templates.find((template) => template.assetId === selectedAssetId) || templates[0] || null;
  const filteredTemplates = templates.filter((template) => {
    const mappings = template.campaignMappings || [];
    if (campaignFilter === "all") return true;
    if (campaignFilter === "unassigned") return mappings.length === 0;
    return mappings.some((mapping) => mapping.campaignId === campaignFilter);
  });
  const ownerProfiles = senderProfiles.filter((profile) => profile.active !== false);
  const reusableAudienceLists = audienceLists.filter((list) => list.sourceListId);
  const whatsappSetting = integrationSettings.find((setting) => setting.settingKey === "whatsapp") || initialIntegrationSettings.find((setting) => setting.settingKey === "whatsapp") || {};
  const selectedSender = ownerProfiles.find((profile) => profile.ownerId === testContact.senderOwnerId) || ownerProfiles[0] || null;
  const selectedSenderFirstName = String(selectedSender?.name || "Cloudwrxs").trim().split(/\s+/)[0] || "Cloudwrxs";
  const renderedMessage = selectedTemplate ? renderManualMessage(selectedTemplate.bodyText, { ...testContact, senderName: selectedSenderFirstName }, selectedTemplate.placeholderValues) : "";

  useEffect(() => {
    if (selectedTemplate?.assetId && selectedTemplate.assetId !== selectedAssetId) setSelectedAssetId(selectedTemplate.assetId);
  }, [selectedAssetId, selectedTemplate?.assetId]);

  useEffect(() => {
    if (!testContact.senderOwnerId && ownerProfiles[0]?.ownerId) {
      setTestContact((current) => ({ ...current, senderOwnerId: ownerProfiles[0].ownerId }));
    }
  }, [ownerProfiles, testContact.senderOwnerId]);

  function updateTemplate(field, value) {
    if (!selectedTemplate) return;
    setTemplates((current) => current.map((template) =>
      template.assetId === selectedTemplate.assetId
        ? { ...template, [field]: value, updatedAt: nowIso() }
        : template
    ));
  }

  function updatePlaceholder(key, value) {
    if (!selectedTemplate) return;
    setTemplates((current) => current.map((template) =>
      template.assetId === selectedTemplate.assetId
        ? {
            ...template,
            placeholderValues: {
              ...template.placeholderValues,
              [key]: value
            },
            updatedAt: nowIso()
          }
        : template
    ));
  }

  function createTemplate() {
    const assetId = `whatsapp_${Date.now()}`;
    const next = {
      assetId,
      assetType: "whatsapp",
      internalRef: `custom-whatsapp-${templates.length + 1}`,
      label: "New WhatsApp message",
      status: "draft",
      campaignMappings: [],
      bodyText: "Hi {{FIRST_NAME}}, it is {{SENDER_NAME}} from Cloudwrxs.\n\nWrite the WhatsApp message here.\n\n{{WEBSITE_LINK}}",
      launchMode: "manual_whatsapp_business",
      placeholderValues: {
        WEBSITE_LINK: "https://cloudwrxs.com/?link=whatsapp"
      },
      updatedAt: nowIso()
    };
    setTemplates((current) => [next, ...current]);
    setSelectedAssetId(assetId);
  }

  function cloneTemplate() {
    if (!selectedTemplate) return;
    const assetId = `whatsapp_clone_${Date.now()}`;
    setTemplates((current) => [
      {
        ...selectedTemplate,
        assetId,
        internalRef: `${selectedTemplate.internalRef}-clone-${templates.length + 1}`,
        label: `${selectedTemplate.label} copy`,
        status: "draft",
        updatedAt: nowIso()
      },
      ...current
    ]);
    setSelectedAssetId(assetId);
  }

  function deleteTemplate() {
    if (!selectedTemplate || templates.length <= 1) return;
    setDeletedContentAssetIds((current) => Array.from(new Set([...current, selectedTemplate.assetId])));
    setTemplates((current) => current.filter((template) => template.assetId !== selectedTemplate.assetId));
    setSelectedAssetId(templates.find((template) => template.assetId !== selectedTemplate.assetId)?.assetId || "");
  }

  function addMapping(campaignId) {
    if (!selectedTemplate || !campaignId) return;
    const campaign = campaigns.find((item) => item.id === campaignId);
    const mappingsForCampaign = selectedTemplate.campaignMappings?.filter((mapping) => mapping.campaignId === campaignId) || [];
    const campaignComponent = campaign?.events?.find((event) => event.type === "whatsapp" && !mappingsForCampaign.some((mapping) => mapping.componentActivityId === event.id || mapping.stepKey === event.label)) || null;
    const stepKey = campaignComponent?.label || `WhatsApp${mappingsForCampaign.length + 1}`;
    const defaultAudienceListId = reusableAudienceLists.find((list) => (list.associatedCampaignIds || []).includes(campaignId))?.listId || "";
    const defaultOwnerId = ownerProfiles[0]?.ownerId || "amaan";
    setTemplates((current) => current.map((template) => {
      if (template.assetId !== selectedTemplate.assetId) return template;
      const mappings = template.campaignMappings || [];
      return {
        ...template,
        campaignMappings: [
          ...mappings,
          {
            audienceListId: defaultAudienceListId,
            campaignId,
            componentActivityId: campaignComponent?.id || "",
            stepKey,
            label: campaignComponent?.title || (campaign ? `${campaign.shortName} ${stepKey}` : stepKey),
            owner: defaultOwnerId,
            ownerIds: [defaultOwnerId],
            personaFilter: "ALL",
            senderAllocationMode: "equal",
            senderLocked: false
          }
        ],
        updatedAt: nowIso()
      };
    }));
  }

  function updateMapping(index, field, value) {
    if (!selectedTemplate) return;
    setTemplates((current) => current.map((template) => {
      if (template.assetId !== selectedTemplate.assetId) return template;
      const campaignMappings = [...(template.campaignMappings || [])];
      campaignMappings[index] = { ...campaignMappings[index], [field]: value };
      return { ...template, campaignMappings, updatedAt: nowIso() };
    }));
  }

  function updateMappingFields(index, patch) {
    if (!selectedTemplate) return;
    setTemplates((current) => current.map((template) => {
      if (template.assetId !== selectedTemplate.assetId) return template;
      const campaignMappings = [...(template.campaignMappings || [])];
      campaignMappings[index] = { ...campaignMappings[index], ...patch };
      return { ...template, campaignMappings, updatedAt: nowIso() };
    }));
  }

  function removeMapping(index) {
    if (!selectedTemplate) return;
    setTemplates((current) => current.map((template) =>
      template.assetId === selectedTemplate.assetId
        ? {
            ...template,
            campaignMappings: (template.campaignMappings || []).filter((_, mappingIndex) => mappingIndex !== index),
            updatedAt: nowIso()
          }
        : template
    ));
  }

  function copyRenderedMessage() {
    if (!renderedMessage) return;
    navigator.clipboard?.writeText(renderedMessage).catch(() => {});
  }

  function openWhatsApp() {
    const phone = String(testContact.phone || "").replace(/[^\d]/g, "");
    const params = new URLSearchParams({ text: renderedMessage });
    const url = phone ? `https://wa.me/${phone}?${params.toString()}` : `https://wa.me/?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function sendWhatsAppApiTest() {
    setManualSendStatus("Sending WhatsApp test message...");
    try {
      if (!selectedSender?.whatsappPhoneNumberId) throw new Error("Selected user needs a WhatsApp phone number ID in Settings.");
      const response = await fetch(`${campaignApiUrl}/whatsapp/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          apiVersion: whatsappSetting.apiVersion,
          bodyText: renderedMessage,
          phoneNumberId: selectedSender.whatsappPhoneNumberId,
          recipientPhone: testContact.phone,
          secretName: whatsappSetting.secretName,
          senderOwnerId: selectedSender.ownerId,
          templateAssetId: selectedTemplate?.assetId || ""
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `WhatsApp send failed: ${response.status}`);
      setManualSendStatus(`WhatsApp API accepted message ${result.messageId || ""}`.trim());
    } catch (error) {
      setManualSendStatus(error.message);
    }
  }

  return (
    <ContentAssetWorkspace
      assetKind="whatsapp"
      audienceLists={audienceLists}
      authHeaders={authHeaders}
      campaignFilter={campaignFilter}
      campaignApiUrl={campaignApiUrl}
      campaigns={campaigns}
      contentAssetTablePlan={contentAssetTablePlan}
      createAsset={createTemplate}
      cloneAsset={cloneTemplate}
      deleteAsset={deleteTemplate}
      filteredAssets={filteredTemplates}
      selectedAsset={selectedTemplate}
      selectedAssetId={selectedAssetId}
      setCampaignFilter={setCampaignFilter}
      setSelectedAssetId={setSelectedAssetId}
      title="WhatsApp messages"
      subtitle="Reusable WhatsApp Business copy"
      icon={MessageCircle}
      addMapping={addMapping}
      updateMapping={updateMapping}
      updateMappingFields={updateMappingFields}
      removeMapping={removeMapping}
      createCampaignComponent={createCampaignComponent}
      senderProfiles={senderProfiles}
      updateAsset={updateTemplate}
      bodyFields={(
        <>
          <label className="body-field">
            <span>Message body</span>
            <textarea value={selectedTemplate?.bodyText || ""} onChange={(event) => updateTemplate("bodyText", event.target.value)} />
          </label>
          <label>
            <span>Website link</span>
            <input value={selectedTemplate?.placeholderValues?.WEBSITE_LINK || ""} onChange={(event) => updatePlaceholder("WEBSITE_LINK", event.target.value)} />
          </label>
        </>
      )}
      sidePanel={selectedTemplate ? (
        <section className="panel manual-launch-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Manual launch</p>
              <h2>WhatsApp Business</h2>
            </div>
            <MessageCircle size={20} />
          </div>
          <div className="manual-test-grid">
            <label>
              <span>First name</span>
              <input value={testContact.firstName} onChange={(event) => setTestContact((current) => ({ ...current, firstName: event.target.value }))} />
            </label>
            <label>
              <span>Phone number</span>
              <input value={testContact.phone} onChange={(event) => setTestContact((current) => ({ ...current, phone: event.target.value }))} placeholder="+971..." />
            </label>
            <label>
              <span>Send as user</span>
              <select value={testContact.senderOwnerId || selectedSender?.ownerId || ""} onChange={(event) => setTestContact((current) => ({ ...current, senderOwnerId: event.target.value }))}>
                {ownerProfiles.map((profile) => (
                  <option key={profile.ownerId} value={profile.ownerId}>{profile.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="sender-whatsapp-summary">
            <strong>{selectedSender?.name || "No user selected"}</strong>
            <span>{selectedSender?.whatsappPhoneNumberId ? `WhatsApp phone number ID ${selectedSender.whatsappPhoneNumberId}` : "No WhatsApp phone number ID configured for this user."}</span>
            <span>{whatsappSetting.secretName ? `Secret: ${whatsappSetting.secretName}` : "WhatsApp API secret is not configured yet."}</span>
          </div>
          <div className="rendered-message-preview">
            <strong>Rendered preview</strong>
            <p>{renderedMessage}</p>
          </div>
          <div className="editor-actions">
            <button className="secondary-button compact" onClick={copyRenderedMessage}>
              <Copy size={15} />
              Copy message
            </button>
            <button className="primary-button compact" onClick={openWhatsApp}>
              <MessageCircle size={15} />
              Launch WhatsApp
            </button>
            <button className="primary-button compact" onClick={sendWhatsAppApiTest} disabled={!campaignApiUrl || !whatsappSetting.secretName || !selectedSender?.whatsappPhoneNumberId || !testContact.phone.trim() || !renderedMessage.trim()}>
              <Send size={15} />
              Send via API
            </button>
          </div>
          {manualSendStatus && <p className="save-status">{manualSendStatus}</p>}
          <p className="asset-helper-note">API sends use Meta WhatsApp Cloud API text messages. For contacts outside an open 24-hour service window, Meta may require an approved template message instead.</p>
        </section>
      ) : null}
    />
  );
}

function CallScriptWorkspace({ campaigns, scripts, setDeletedContentAssetIds, setScripts }) {
  const [selectedAssetId, setSelectedAssetId] = useState(() => scripts[0]?.assetId || initialCallScripts[0]?.assetId);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const selectedScript = scripts.find((script) => script.assetId === selectedAssetId) || scripts[0] || null;
  const filteredScripts = scripts.filter((script) => {
    const mappings = script.campaignMappings || [];
    if (campaignFilter === "all") return true;
    if (campaignFilter === "unassigned") return mappings.length === 0;
    return mappings.some((mapping) => mapping.campaignId === campaignFilter);
  });

  useEffect(() => {
    if (selectedScript?.assetId && selectedScript.assetId !== selectedAssetId) setSelectedAssetId(selectedScript.assetId);
  }, [selectedAssetId, selectedScript?.assetId]);

  function updateScript(field, value) {
    if (!selectedScript) return;
    setScripts((current) => current.map((script) =>
      script.assetId === selectedScript.assetId
        ? { ...script, [field]: value, updatedAt: nowIso() }
        : script
    ));
  }

  function createScript() {
    const assetId = `callscript_${Date.now()}`;
    const next = {
      assetId,
      assetType: "call_script",
      internalRef: `custom-call-script-${scripts.length + 1}`,
      label: "New call script",
      status: "draft",
      campaignMappings: [],
      opening: "Hi {{FIRST_NAME}}, it is {{SENDER_NAME}} from Cloudwrxs.",
      objective: "Write the call objective here.",
      talkTrack: "1. Confirm role and context.\n2. Ask discovery questions.\n3. Agree next step.",
      qualificationQuestions: "",
      objectionHandling: "",
      close: "Would it make sense to book a short follow-up?",
      updatedAt: nowIso()
    };
    setScripts((current) => [next, ...current]);
    setSelectedAssetId(assetId);
  }

  function cloneScript() {
    if (!selectedScript) return;
    const assetId = `callscript_clone_${Date.now()}`;
    setScripts((current) => [
      {
        ...selectedScript,
        assetId,
        internalRef: `${selectedScript.internalRef}-clone-${scripts.length + 1}`,
        label: `${selectedScript.label} copy`,
        status: "draft",
        updatedAt: nowIso()
      },
      ...current
    ]);
    setSelectedAssetId(assetId);
  }

  function deleteScript() {
    if (!selectedScript || scripts.length <= 1) return;
    setDeletedContentAssetIds((current) => Array.from(new Set([...current, selectedScript.assetId])));
    setScripts((current) => current.filter((script) => script.assetId !== selectedScript.assetId));
    setSelectedAssetId(scripts.find((script) => script.assetId !== selectedScript.assetId)?.assetId || "");
  }

  function addMapping(campaignId) {
    if (!selectedScript || !campaignId) return;
    const campaign = campaigns.find((item) => item.id === campaignId);
    setScripts((current) => current.map((script) => {
      if (script.assetId !== selectedScript.assetId) return script;
      const mappings = script.campaignMappings || [];
      const stepKey = `Call${mappings.filter((mapping) => mapping.campaignId === campaignId).length + 1}`;
      return {
        ...script,
        campaignMappings: [
          ...mappings,
          {
            campaignId,
            stepKey,
            label: campaign ? `${campaign.shortName} ${stepKey}` : stepKey
          }
        ],
        updatedAt: nowIso()
      };
    }));
  }

  function updateMapping(index, field, value) {
    if (!selectedScript) return;
    setScripts((current) => current.map((script) => {
      if (script.assetId !== selectedScript.assetId) return script;
      const campaignMappings = [...(script.campaignMappings || [])];
      campaignMappings[index] = { ...campaignMappings[index], [field]: value };
      return { ...script, campaignMappings, updatedAt: nowIso() };
    }));
  }

  function removeMapping(index) {
    if (!selectedScript) return;
    setScripts((current) => current.map((script) =>
      script.assetId === selectedScript.assetId
        ? {
            ...script,
            campaignMappings: (script.campaignMappings || []).filter((_, mappingIndex) => mappingIndex !== index),
            updatedAt: nowIso()
          }
        : script
    ));
  }

  function copyScript() {
    if (!selectedScript) return;
    const scriptText = [
      selectedScript.opening,
      "",
      `Objective: ${selectedScript.objective || ""}`,
      "",
      selectedScript.talkTrack,
      "",
      selectedScript.qualificationQuestions ? `Questions:\n${selectedScript.qualificationQuestions}` : "",
      selectedScript.objectionHandling ? `Objections:\n${selectedScript.objectionHandling}` : "",
      selectedScript.close ? `Close:\n${selectedScript.close}` : ""
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(scriptText).catch(() => {});
  }

  return (
    <ContentAssetWorkspace
      assetKind="call_script"
      campaignFilter={campaignFilter}
      campaigns={campaigns}
      contentAssetTablePlan={contentAssetTablePlan}
      createAsset={createScript}
      cloneAsset={cloneScript}
      deleteAsset={deleteScript}
      filteredAssets={filteredScripts}
      selectedAsset={selectedScript}
      selectedAssetId={selectedAssetId}
      setCampaignFilter={setCampaignFilter}
      setSelectedAssetId={setSelectedAssetId}
      title="Call scripts"
      subtitle="Reusable sales talk tracks"
      icon={Phone}
      addMapping={addMapping}
      updateMapping={updateMapping}
      removeMapping={removeMapping}
      updateAsset={updateScript}
      bodyFields={(
        <>
          <label className="body-field">
            <span>Opening</span>
            <textarea value={selectedScript?.opening || ""} onChange={(event) => updateScript("opening", event.target.value)} />
          </label>
          <label className="body-field">
            <span>Objective</span>
            <textarea value={selectedScript?.objective || ""} onChange={(event) => updateScript("objective", event.target.value)} />
          </label>
          <label className="body-field">
            <span>Talk track</span>
            <textarea value={selectedScript?.talkTrack || ""} onChange={(event) => updateScript("talkTrack", event.target.value)} />
          </label>
          <label className="body-field">
            <span>Qualification questions</span>
            <textarea value={selectedScript?.qualificationQuestions || ""} onChange={(event) => updateScript("qualificationQuestions", event.target.value)} />
          </label>
          <label className="body-field">
            <span>Objection handling</span>
            <textarea value={selectedScript?.objectionHandling || ""} onChange={(event) => updateScript("objectionHandling", event.target.value)} />
          </label>
          <label className="body-field">
            <span>Close</span>
            <textarea value={selectedScript?.close || ""} onChange={(event) => updateScript("close", event.target.value)} />
          </label>
        </>
      )}
      sidePanel={selectedScript ? (
        <section className="panel manual-launch-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Sales enablement</p>
              <h2>Script preview</h2>
            </div>
            <Phone size={20} />
          </div>
          <div className="script-preview">
            <strong>Opening</strong>
            <p>{selectedScript.opening}</p>
            <strong>Objective</strong>
            <p>{selectedScript.objective}</p>
            <strong>Close</strong>
            <p>{selectedScript.close}</p>
          </div>
          <button className="secondary-button compact" onClick={copyScript}>
            <Copy size={15} />
            Copy full script
          </button>
          <p className="asset-helper-note">These scripts can be surfaced inside Lead Nurture next to the JustCall controls once we link campaign call steps to script assets.</p>
        </section>
      ) : null}
    />
  );
}

function ContentAssetWorkspace({
  addMapping,
  assetKind,
  audienceLists = [],
  authHeaders = {},
  bodyFields,
  campaignFilter,
  campaignApiUrl = "",
  campaigns,
  cloneAsset,
  contentAssetTablePlan,
  createCampaignComponent,
  createAsset,
  deleteAsset,
  filteredAssets,
  icon: Icon,
  removeMapping,
  selectedAsset,
  selectedAssetId,
  setCampaignFilter,
  setSelectedAssetId,
  sidePanel,
  subtitle,
  title,
  updateAsset,
  updateMapping,
  updateMappingFields,
  senderProfiles = []
}) {
  const [personaOptionsByAudience, setPersonaOptionsByAudience] = useState({});
  const [whatsappComponentDrafts, setWhatsappComponentDrafts] = useState({});
  const mappings = selectedAsset?.campaignMappings || [];
  const unusedCampaigns = campaigns.filter((campaign) => !mappings.some((mapping) => mapping.campaignId === campaign.id));
  const ownerProfiles = senderProfiles.filter((profile) => profile.active !== false);
  const ownerProfileMap = Object.fromEntries(ownerProfiles.map((profile) => [profile.ownerId, profile]));
  const reusableAudienceLists = audienceLists.filter((list) => list.sourceListId);
  const detectedPlaceholders = placeholderKeys([
    selectedAsset?.bodyText,
    selectedAsset?.opening,
    selectedAsset?.objective,
    selectedAsset?.talkTrack,
    selectedAsset?.qualificationQuestions,
    selectedAsset?.objectionHandling,
    selectedAsset?.close
  ].filter(Boolean).join("\n"));

  function updateMappingPatch(index, patch) {
    if (updateMappingFields) {
      updateMappingFields(index, patch);
      return;
    }
    Object.entries(patch).forEach(([field, value]) => updateMapping(index, field, value));
  }

  function campaignAssignedAudienceLists(campaignId) {
    return reusableAudienceLists.filter((list) => (list.associatedCampaignIds || []).includes(campaignId));
  }

  function selectedAudienceListIdForMapping(mapping) {
    const assignedLists = campaignAssignedAudienceLists(mapping.campaignId);
    if (mapping.audienceListId && assignedLists.some((list) => list.listId === mapping.audienceListId)) return mapping.audienceListId;
    return assignedLists[0]?.listId || "";
  }

  function mappingOwnerIds(mapping) {
    const ids = Array.isArray(mapping.ownerIds) ? mapping.ownerIds : [mapping.owner || ownerProfiles[0]?.ownerId || "amaan"];
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function senderSplitLabel(senderCount) {
    if (!senderCount) return "0%";
    const split = 100 / senderCount;
    return Number.isInteger(split) ? `${split}%` : `${split.toFixed(1)}%`;
  }

  function updateMappingOwners(index, ownerIds) {
    const nextOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)));
    updateMappingPatch(index, {
      owner: nextOwnerIds[0] || "",
      ownerIds: nextOwnerIds,
      senderAllocationMode: "equal"
    });
  }

  function addMappingOwner(index, mapping, ownerId) {
    if (!ownerId || mapping.senderLocked) return;
    updateMappingOwners(index, [...mappingOwnerIds(mapping), ownerId]);
  }

  function replaceMappingOwner(index, mapping, slotIndex, ownerId) {
    if (!ownerId) return;
    const next = mappingOwnerIds(mapping);
    next[slotIndex] = ownerId;
    updateMappingOwners(index, next);
  }

  function removeMappingOwner(index, mapping, ownerId) {
    if (mapping.senderLocked) return;
    updateMappingOwners(index, mappingOwnerIds(mapping).filter((id) => id !== ownerId));
  }

  async function loadPersonaOptionsForAudience(audienceListId) {
    if (!campaignApiUrl || !audienceListId || personaOptionsByAudience[audienceListId]) return;
    setPersonaOptionsByAudience((current) => ({
      ...current,
      [audienceListId]: { loading: true, none: 0, options: [], total: 0 }
    }));
    try {
      const params = new URLSearchParams({ facet: "persona", listId: audienceListId });
      const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Persona lookup failed: ${response.status}`);
      setPersonaOptionsByAudience((current) => ({
        ...current,
        [audienceListId]: {
          loading: false,
          none: result.none || 0,
          options: result.options || [],
          total: result.total || 0
        }
      }));
    } catch (error) {
      setPersonaOptionsByAudience((current) => ({
        ...current,
        [audienceListId]: { error: error.message, loading: false, none: 0, options: [], total: 0 }
      }));
    }
  }

  function whatsappComponentsForCampaign(campaignId) {
    const campaign = campaigns.find((item) => item.id === campaignId);
    return (campaign?.events || []).filter((event) => event.type === "whatsapp");
  }

  function selectedWhatsappComponent(mapping) {
    const components = whatsappComponentsForCampaign(mapping.campaignId);
    return components.find((event) => event.id === mapping.componentActivityId)
      || components.find((event) => event.label && event.label === mapping.stepKey)
      || components.find((event) => event.title && event.title === mapping.label)
      || null;
  }

  function whatsappComponentDraftKey(index, mapping) {
    return `${selectedAsset?.assetId || "asset"}:${mapping.campaignId}:${index}`;
  }

  function nextWhatsappComponentLabel(campaignId) {
    const components = whatsappComponentsForCampaign(campaignId);
    let nextIndex = components.length + 1;
    let candidate = `WhatsApp${nextIndex}`;
    const usedLabels = new Set(components.map((event) => String(event.label || "").trim().toLowerCase()).filter(Boolean));
    while (usedLabels.has(candidate.toLowerCase())) {
      nextIndex += 1;
      candidate = `WhatsApp${nextIndex}`;
    }
    return candidate;
  }

  function startNewWhatsappComponentDraft(index, mapping) {
    const key = whatsappComponentDraftKey(index, mapping);
    setWhatsappComponentDrafts((current) => ({
      ...current,
      [key]: {
        label: nextWhatsappComponentLabel(mapping.campaignId),
        title: ""
      }
    }));
  }

  function clearNewWhatsappComponentDraft(index, mapping) {
    const key = whatsappComponentDraftKey(index, mapping);
    setWhatsappComponentDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function updateNewWhatsappComponentDraft(index, mapping, field, value) {
    const key = whatsappComponentDraftKey(index, mapping);
    setWhatsappComponentDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] || { label: nextWhatsappComponentLabel(mapping.campaignId), title: "" }),
        [field]: value
      }
    }));
  }

  function validateWhatsappComponentDraft(mapping, draft) {
    const normalizedTitle = String(draft?.title || "").trim().toLowerCase();
    const normalizedLabel = String(draft?.label || "").trim().toLowerCase();
    const components = whatsappComponentsForCampaign(mapping.campaignId);
    const errors = {};
    if (!normalizedTitle) errors.title = "Task title is required.";
    if (!normalizedLabel) errors.label = "Label is required.";
    if (normalizedTitle && components.some((event) => String(event.title || "").trim().toLowerCase() === normalizedTitle)) {
      errors.title = "That task title is already used in this campaign.";
    }
    if (normalizedLabel && components.some((event) => String(event.label || "").trim().toLowerCase() === normalizedLabel)) {
      errors.label = "That label is already used in this campaign.";
    }
    return errors;
  }

  function updateMappingFromComponent(index, component) {
    if (!component) return;
    updateMappingPatch(index, {
      componentActivityId: component.id,
      stepKey: component.label || "",
      label: component.title || component.label || ""
    });
  }

  function createWhatsappComponentForMapping(index, mapping, draft) {
    const campaign = campaigns.find((item) => item.id === mapping.campaignId);
    if (!campaign || !createCampaignComponent) return;
    const errors = validateWhatsappComponentDraft(mapping, draft);
    if (Object.keys(errors).length) return;
    const component = createCampaignComponent(mapping.campaignId, {
      type: "whatsapp",
      label: String(draft.label || "").trim(),
      title: String(draft.title || "").trim(),
      section: "Activities"
    });
    if (component) {
      updateMappingFromComponent(index, component);
      clearNewWhatsappComponentDraft(index, mapping);
    }
  }

  function handleWhatsappComponentSelect(index, mapping, componentId) {
    if (componentId === "__new__") {
      startNewWhatsappComponentDraft(index, mapping);
      return;
    }
    clearNewWhatsappComponentDraft(index, mapping);
    const component = whatsappComponentsForCampaign(mapping.campaignId).find((event) => event.id === componentId);
    updateMappingFromComponent(index, component);
  }

  return (
    <div className="email-workspace content-asset-workspace">
      <section className="panel schema-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Campaign content assets</p>
            <h2>{title}</h2>
          </div>
          <Icon size={20} />
        </div>
        <div className="schema-grid">
          {contentAssetTablePlan.map((item) => (
            <div className="schema-card" key={item.table}>
              <strong>{item.table}</strong>
              <span>{item.key}</span>
              <p>{item.purpose}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel email-library">
        <div className="panel-head">
          <h3>{subtitle}</h3>
          <button className="icon-button compact" title={`Create ${title}`} onClick={createAsset}>
            <Plus size={16} />
          </button>
        </div>
        <label className="email-library-filter">
          <span>Filter by campaign</span>
          <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)}>
            <option value="unassigned">Unassigned</option>
            <option value="all">All assets</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
            ))}
          </select>
        </label>
        <div className="email-list">
          {filteredAssets.map((asset) => {
            const usageCount = (asset.campaignMappings || []).length;
            return (
              <button
                className={asset.assetId === selectedAssetId ? "selected" : ""}
                key={asset.assetId}
                onClick={() => setSelectedAssetId(asset.assetId)}
              >
                <strong>{asset.label}</strong>
                <span>{asset.internalRef}</span>
                <small>{asset.status} · mapped to {usageCount} campaign step{usageCount === 1 ? "" : "s"}</small>
              </button>
            );
          })}
          {!filteredAssets.length && <p className="empty-library-note">No assets match this filter.</p>}
        </div>
      </section>

      {selectedAsset ? (
        <>
          <section className="panel email-editor content-asset-editor">
            <div className="section-head">
              <div>
                <p className="eyebrow">{assetKind === "whatsapp" ? "WhatsApp template" : "Call script"}</p>
                <h2>{selectedAsset.label}</h2>
              </div>
              <div className="editor-actions">
                <button className="icon-button compact" title="Clone asset" onClick={cloneAsset}>
                  <Copy size={16} />
                </button>
                <button className="icon-button compact danger" title="Delete asset" onClick={deleteAsset}>
                  <Trash2 size={16} />
                </button>
                <button className="primary-button compact" title="Saved automatically">
                  <Save size={16} />
                  Saved
                </button>
              </div>
            </div>
            <div className="email-form content-asset-form">
              <label>
                <span>Internal reference</span>
                <input value={selectedAsset.internalRef || ""} onChange={(event) => updateAsset("internalRef", event.target.value)} />
              </label>
              <label>
                <span>User label</span>
                <input value={selectedAsset.label || ""} onChange={(event) => updateAsset("label", event.target.value)} />
              </label>
              <label>
                <span>Status</span>
                <select value={selectedAsset.status || "draft"} onChange={(event) => updateAsset("status", event.target.value)}>
                  <option value="draft">draft</option>
                  <option value="approved">approved</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label>
                <span>Launch mode</span>
                <select value={selectedAsset.launchMode || "manual"} onChange={(event) => updateAsset("launchMode", event.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="manual_whatsapp_business">Manual WhatsApp Business</option>
                  <option value="justcall_assisted">JustCall assisted</option>
                </select>
              </label>
              {bodyFields}
              {!!detectedPlaceholders.length && (
                <div className="placeholder-row">
                  {detectedPlaceholders.map((key) => (
                    <span key={key}>{`{{${key}}}`}</span>
                  ))}
                </div>
              )}
            </div>
          </section>
          {sidePanel}
          <section className="panel assignment-panel content-assignment-panel">
            <div className="panel-head">
              <h3>Campaign mapping</h3>
              <select className="compact-select" value="" onChange={(event) => addMapping(event.target.value)} disabled={!unusedCampaigns.length}>
                <option value="">{unusedCampaigns.length ? "Assign to campaign..." : "All campaigns assigned"}</option>
                {unusedCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
                ))}
              </select>
            </div>
            <div className="asset-mapping-list">
              {mappings.map((mapping, index) => {
                const campaign = campaigns.find((item) => item.id === mapping.campaignId);
                if (assetKind === "whatsapp") {
                  const assignedAudienceLists = campaignAssignedAudienceLists(mapping.campaignId);
                  const selectedAudienceListId = selectedAudienceListIdForMapping(mapping);
                  const personaFacet = personaOptionsByAudience[selectedAudienceListId] || { none: 0, options: [], total: 0 };
                  const selectedPersonaFilter = normalizePersonaFilter(mapping.personaFilter || mapping.persona || "ALL");
                  const senderIds = mappingOwnerIds(mapping);
                  const splitLabel = senderSplitLabel(senderIds.length);
                  const availableOwnerProfiles = ownerProfiles.filter((profile) => !senderIds.includes(profile.ownerId));
                  const whatsappComponents = whatsappComponentsForCampaign(mapping.campaignId);
                  const selectedComponent = selectedWhatsappComponent(mapping);
                  const selectedComponentId = selectedComponent?.id || "";
                  const newComponentDraft = whatsappComponentDrafts[whatsappComponentDraftKey(index, mapping)];
                  const newComponentErrors = newComponentDraft ? validateWhatsappComponentDraft(mapping, newComponentDraft) : {};
                  const canCreateComponent = newComponentDraft && !Object.keys(newComponentErrors).length;
                  return (
                    <article className="assignment-card whatsapp-mapping-card" key={`${mapping.campaignId}-${mapping.stepKey}-${index}`}>
                      <div className="assignment-card-heading">
                        <div>
                          <strong>{campaign?.shortName || mapping.campaignId}</strong>
                          <span>{mapping.stepKey || "WhatsApp"} · {personaFilterLabel(selectedPersonaFilter)} · {senderIds.length} sender{senderIds.length === 1 ? "" : "s"} · equal split</span>
                        </div>
                        <button className="icon-button compact danger" title="Remove mapping" onClick={() => removeMapping(index)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <label>
                        <span>Task title</span>
                        <select value={newComponentDraft ? "__new__" : selectedComponentId} onChange={(event) => handleWhatsappComponentSelect(index, mapping, event.target.value)}>
                          <option value="__new__">New WhatsApp component...</option>
                          {!selectedComponentId && <option value="" disabled hidden>Select campaign component title...</option>}
                          {whatsappComponents.map((component) => (
                            <option key={component.id} value={component.id}>{component.title || component.label || "Untitled WhatsApp component"}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Label</span>
                        <input className="component-readonly-input" value={newComponentDraft ? "Set below for the new component" : (selectedComponent?.label || mapping.stepKey || "")} readOnly />
                      </label>
                      {newComponentDraft && (
                        <div className="component-create-panel">
                          <label>
                            <span>New task title</span>
                            <input value={newComponentDraft.title || ""} onChange={(event) => updateNewWhatsappComponentDraft(index, mapping, "title", event.target.value)} />
                            {newComponentErrors.title && <small className="field-error">{newComponentErrors.title}</small>}
                          </label>
                          <label>
                            <span>New label</span>
                            <input value={newComponentDraft.label || ""} onChange={(event) => updateNewWhatsappComponentDraft(index, mapping, "label", event.target.value)} />
                            {newComponentErrors.label && <small className="field-error">{newComponentErrors.label}</small>}
                          </label>
                          <div className="component-create-actions">
                            <button className="primary-button compact" onClick={() => createWhatsappComponentForMapping(index, mapping, newComponentDraft)} disabled={!canCreateComponent}>
                              <Plus size={14} />
                              Create component
                            </button>
                            <button className="secondary-button compact" onClick={() => clearNewWhatsappComponentDraft(index, mapping)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="assignment-targeting-grid">
                        <label className="assignment-targeting-control">
                          <span>Campaign audience</span>
                          <select
                            value={selectedAudienceListId}
                            onFocus={() => loadPersonaOptionsForAudience(selectedAudienceListId)}
                            onChange={(event) => {
                              updateMappingPatch(index, { audienceListId: event.target.value, personaFilter: "ALL" });
                              loadPersonaOptionsForAudience(event.target.value);
                            }}
                            disabled={!assignedAudienceLists.length}
                          >
                            {!assignedAudienceLists.length && <option value="">No audience assigned to {campaign?.shortName || "this campaign"}</option>}
                            {assignedAudienceLists.map((list) => (
                              <option key={list.listId} value={list.listId}>{list.name}</option>
                            ))}
                          </select>
                        </label>
                        <small className="assignment-targeting-help">
                          {assignedAudienceLists.length
                            ? `Showing ${assignedAudienceLists.length} audience${assignedAudienceLists.length === 1 ? "" : "s"} assigned to ${campaign?.shortName || "this campaign"}.`
                            : `Assign a reusable audience to ${campaign?.shortName || "this campaign"} on the Audience page.`}
                        </small>
                        <label className="assignment-targeting-control">
                          <span>Persona</span>
                          <select
                            value={selectedPersonaFilter}
                            onFocus={() => loadPersonaOptionsForAudience(selectedAudienceListId)}
                            onChange={(event) => updateMapping(index, "personaFilter", event.target.value)}
                            disabled={!selectedAudienceListId}
                          >
                            <option value="ALL">ALL{personaFacet.total ? ` (${personaFacet.total.toLocaleString()})` : ""}</option>
                            <option value="__NONE__">UNSET{personaFacet.none ? ` (${personaFacet.none.toLocaleString()})` : ""}</option>
                            {personaFacet.options.map((option) => (
                              <option key={option.value} value={option.value}>{option.value}{option.count ? ` (${option.count.toLocaleString()})` : ""}</option>
                            ))}
                          </select>
                        </label>
                        <small className="assignment-targeting-help">{personaFacet.loading ? "Loading personas..." : personaFacet.error || "Defaults to ALL if no persona is selected."}</small>
                      </div>
                      <div className="sender-roster">
                        <div>
                          <span>WhatsApp senders</span>
                          <small>{mapping.senderLocked ? "Locked after first send. Replace only." : `Contacts will be split evenly, ${splitLabel} each.`}</small>
                        </div>
                        {senderIds.map((ownerId, slotIndex) => {
                          const sender = ownerProfileMap[ownerId] || ownerProfiles[0];
                          const replacementOptions = ownerProfiles.filter((profile) => profile.ownerId === ownerId || !senderIds.includes(profile.ownerId));
                          return (
                            <div className="sender-slot" key={`${mapping.campaignId}-${mapping.stepKey}-${ownerId}-${slotIndex}`}>
                              <select value={ownerId} onChange={(event) => replaceMappingOwner(index, mapping, slotIndex, event.target.value)}>
                                {replacementOptions.map((profile) => (
                                  <option key={profile.ownerId} value={profile.ownerId}>{profile.name}</option>
                                ))}
                              </select>
                              <span>{splitLabel}</span>
                              <button className="icon-button compact danger" title={mapping.senderLocked ? "Sender roster is locked; replace this sender instead" : "Remove sender"} onClick={() => removeMappingOwner(index, mapping, ownerId)} disabled={mapping.senderLocked}>
                                <Trash2 size={13} />
                              </button>
                              <small>{sender?.email || "No sender email"}</small>
                            </div>
                          );
                        })}
                        {!senderIds.length && <p className="sender-empty-note">No sender assigned. Add at least one sender before sending.</p>}
                        <div className="sender-add-row">
                          <select value="" onChange={(event) => addMappingOwner(index, mapping, event.target.value)} disabled={mapping.senderLocked || !availableOwnerProfiles.length}>
                            <option value="">{mapping.senderLocked ? "Sender list locked" : "Add sender..."}</option>
                            {availableOwnerProfiles.map((profile) => (
                              <option key={profile.ownerId} value={profile.ownerId}>{profile.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="resolved-owner-card">
                        <span>Routing rule</span>
                        <strong>{mapping.senderLocked ? "Sender split locked" : "Equal sender split pending first send"}</strong>
                        <small>{senderIds.map((id) => ownerProfileMap[id]?.name || id).join(" / ")}</small>
                        <em>WhatsApp launches should use the assigned employee for each contact.</em>
                      </div>
                      <label className="toggle-row">
                        <input type="checkbox" checked={Boolean(mapping.senderLocked)} onChange={(event) => updateMapping(index, "senderLocked", event.target.checked)} />
                        <span>First WhatsApp send recorded - lock sender roster</span>
                      </label>
                    </article>
                  );
                }
                return (
                  <article className="asset-mapping-row" key={`${mapping.campaignId}-${mapping.stepKey}-${index}`}>
                    <strong>{campaign?.shortName || mapping.campaignId}</strong>
                    <label>
                      <span>Step key</span>
                      <input value={mapping.stepKey || ""} onChange={(event) => updateMapping(index, "stepKey", event.target.value)} />
                    </label>
                    <label>
                      <span>Task label</span>
                      <input value={mapping.label || ""} onChange={(event) => updateMapping(index, "label", event.target.value)} />
                    </label>
                    <button className="icon-button compact danger" title="Remove mapping" onClick={() => removeMapping(index)}>
                      <Trash2 size={14} />
                    </button>
                  </article>
                );
              })}
              {!mappings.length && <p className="empty-library-note">This asset is not mapped to a campaign step yet.</p>}
            </div>
          </section>
        </>
      ) : (
        <section className="panel email-empty-state">
          <p className="eyebrow">Campaign content asset</p>
          <h2>No assets match this filter</h2>
          <p>Create a reusable asset, then map it to campaign tasks.</p>
          <button className="primary-button" onClick={createAsset}>
            <Plus size={15} />
            Add asset
          </button>
        </section>
      )}
    </div>
  );
}

function renderManualMessage(text = "", contact = {}, placeholderValues = {}) {
  const values = {
    FIRST_NAME: contact.firstName || "there",
    SENDER_NAME: contact.senderName || "Cloudwrxs",
    WEBSITE_LINK: placeholderValues.WEBSITE_LINK || "",
    CALENDAR_LINK: placeholderValues.CALENDAR_LINK || ""
  };
  return String(text || "").replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_, key) => values[key] ?? "");
}

function EmailWorkspace({
  activeCampaignId,
  assignments,
  audienceLists,
  authHeaders,
  campaignApiUrl,
  campaigns,
  selectedEmailId,
  setActiveCampaignId,
  setAssignments,
  setSelectedEmailId,
  setTemplates,
  senderProfiles,
  templates
}) {
  const [emailCampaignFilter, setEmailCampaignFilter] = useState("all");
  const [selectedAudienceByAssignment, setSelectedAudienceByAssignment] = useState({});
  const [personaOptionsByAudience, setPersonaOptionsByAudience] = useState({});
  const [sendRunFeedback, setSendRunFeedback] = useState({});
  const [sendRuns, setSendRuns] = useState([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const ownerProfiles = senderProfiles.filter((profile) => profile.active !== false);
  const ownerProfileMap = Object.fromEntries(ownerProfiles.map((profile) => [profile.ownerId, profile]));
  const filteredTemplates = templates.filter((template) => {
    const templateAssignments = assignments.filter((assignment) => assignment.emailId === template.emailId);
    if (emailCampaignFilter === "all") return true;
    if (emailCampaignFilter === "unassigned") return templateAssignments.length === 0;
    return templateAssignments.some((assignment) => assignment.campaignId === emailCampaignFilter);
  });
  const selectedTemplate = filteredTemplates.find((template) => template.emailId === selectedEmailId) || filteredTemplates[0] || null;
  const selectedAssignments = selectedTemplate ? assignments.filter((assignment) => assignment.emailId === selectedTemplate.emailId) : [];
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) || campaigns[0];
  const detectedPlaceholders = placeholderKeys(selectedTemplate?.bodyText);
  const reusableAudienceLists = audienceLists.filter((list) => list.sourceListId);

  useEffect(() => {
    if (selectedTemplate?.emailId && selectedTemplate.emailId !== selectedEmailId) {
      setSelectedEmailId(selectedTemplate.emailId);
    }
  }, [selectedEmailId, selectedTemplate?.emailId, setSelectedEmailId]);

  function campaignAssignedAudienceLists(campaignId) {
    return reusableAudienceLists.filter((list) => (list.associatedCampaignIds || []).includes(campaignId));
  }

  function sameAssignment(assignment, target) {
    return (
      assignment.campaignId === target.campaignId &&
      assignment.stepKey === target.stepKey &&
      assignment.emailId === target.emailId
    );
  }

  function selectedAudienceListIdForAssignment(assignment) {
    const key = assignmentKey(assignment);
    const assignedLists = campaignAssignedAudienceLists(assignment.campaignId);
    const override = selectedAudienceByAssignment[key];
    if (override && assignedLists.some((list) => list.listId === override)) return override;
    if (assignment.audienceListId && assignedLists.some((list) => list.listId === assignment.audienceListId)) return assignment.audienceListId;
    return assignedLists[0]?.listId || "";
  }

  useEffect(() => {
    setAssignments((current) => {
      let changed = false;
      const next = current.map((assignment) => {
        const assignedLists = campaignAssignedAudienceLists(assignment.campaignId);
        if (!assignedLists.length) return assignment;
        if (assignment.audienceListId && assignedLists.some((list) => list.listId === assignment.audienceListId)) return assignment;
        if (assignedLists.length !== 1) return assignment;
        changed = true;
        return {
          ...assignment,
          audienceListId: assignedLists[0].listId,
          personaFilter: normalizePersonaFilter(assignment.personaFilter || assignment.persona || "ALL")
        };
      });
      return changed ? next : current;
    });
  }, [audienceLists, assignments.length, setAssignments]);

  useEffect(() => {
    if (!campaignApiUrl) return;
    let cancelled = false;
    const params = activeCampaignId ? `?campaignId=${encodeURIComponent(activeCampaignId)}&limit=25` : "?limit=25";
    fetch(`${campaignApiUrl}/send-runs${params}`, { headers: authHeaders })
      .then((response) => {
        if (!response.ok) throw new Error(`Send run load failed: ${response.status}`);
        return response.json();
      })
      .then((result) => {
        if (!cancelled) setSendRuns(result.sendRuns || []);
      })
      .catch((error) => {
        if (!cancelled) console.error(error);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCampaignId, authHeaders?.Authorization, campaignApiUrl]);

  function updateTemplate(field, value) {
    if (!selectedTemplate) return;
    setTemplates((current) =>
      current.map((template) =>
        template.emailId === selectedTemplate.emailId
          ? {
              ...template,
              [field]: value,
              updatedAt: nowIso()
            }
          : template
      )
    );
  }

  function createAssignmentRecord(emailId, campaign, assignmentSet = assignments) {
    const campaignAssignments = assignmentSet.filter((assignment) => assignment.campaignId === campaign.id);
    const nextStep = `Email${campaignAssignments.length + 1}`;
    const defaultAudienceListId = campaignAssignedAudienceLists(campaign.id)[0]?.listId || "";
    return {
      campaignId: campaign.id,
      stepKey: nextStep,
      emailId,
      label: `${campaign.shortName} ${nextStep}`,
      persona: "ALL",
      personaFilter: "ALL",
      owner: ownerProfiles[0]?.ownerId || "amaan",
      ownerIds: [ownerProfiles[0]?.ownerId || "amaan"],
      senderAllocationMode: "equal",
      senderLocked: false,
      contactOwnerAssignments: {},
      audienceListId: defaultAudienceListId,
      sendMode: "manual_review",
      requiresApproval: true,
      autoSendEnabled: false,
      sendWindow: "09:00-11:00",
      timezone: userTimezone(),
      sendDate: tomorrowInputDate(),
      enabled: true,
      placeholderValues: {
        WEBSITE_LINK: "https://cloudwrxs.com/finops?link=website"
      }
    };
  }

  function createTemplate({ assignToCurrentFilter = true } = {}) {
    const timestamp = Date.now();
    const emailId = `email_custom_${timestamp}`;
    const template = {
      emailId,
      internalRef: `custom-email-${templates.length + 1}`,
      label: "New campaign email",
      subject: "New email subject",
      bodyText: "Hi {{FIRST_NAME}},\n\nWrite the email body here.\n\n{{WEBSITE_LINK}}\n\n{{CALENDAR_LINK}}",
      status: "draft",
      channel: "email",
      clonedFromEmailId: null,
      createdBy: "local-editor",
      updatedAt: nowIso()
    };
    setTemplates((current) => [template, ...current]);
    setSelectedEmailId(emailId);
    if (assignToCurrentFilter && !["all", "unassigned"].includes(emailCampaignFilter)) {
      const campaign = campaigns.find((item) => item.id === emailCampaignFilter);
      if (campaign) {
        setAssignments((current) => [...current, createAssignmentRecord(emailId, campaign, current)]);
        setActiveCampaignId(campaign.id);
      }
    }
  }

  function cloneTemplate() {
    if (!selectedTemplate) return;
    const timestamp = Date.now();
    const emailId = `email_clone_${timestamp}`;
    const clone = {
      ...selectedTemplate,
      emailId,
      internalRef: `${selectedTemplate.internalRef}-clone-${templates.length + 1}`,
      label: `${selectedTemplate.label} copy`,
      status: "draft",
      clonedFromEmailId: selectedTemplate.emailId,
      createdBy: "local-editor",
      updatedAt: nowIso()
    };
    setTemplates((current) => [clone, ...current]);
    setSelectedEmailId(emailId);
  }

  function assignToCampaign() {
    if (!selectedTemplate || !activeCampaign) return;
    setAssignments((current) => [...current, createAssignmentRecord(selectedTemplate.emailId, activeCampaign, current)]);
    setAssignDialogOpen(false);
  }

  function assignmentOwnerIds(assignment) {
    const ids = Array.isArray(assignment.ownerIds)
      ? assignment.ownerIds
      : [assignment.owner || ownerProfiles[0]?.ownerId || "amaan"];
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function senderSplitLabel(senderCount) {
    if (!senderCount) return "0%";
    const split = 100 / senderCount;
    return Number.isInteger(split) ? `${split}%` : `${split.toFixed(1)}%`;
  }

  function updateAssignmentOwners(target, ownerIds) {
    const nextOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)));
    setAssignments((current) =>
      current.map((assignment) =>
        sameAssignment(assignment, target)
          ? {
              ...assignment,
              owner: nextOwnerIds[0] || "",
              ownerIds: nextOwnerIds,
              senderAllocationMode: "equal"
            }
          : assignment
      )
    );
  }

  function addAssignmentOwner(target, ownerId) {
    if (!ownerId || target.senderLocked) return;
    updateAssignmentOwners(target, [...assignmentOwnerIds(target), ownerId]);
  }

  function replaceAssignmentOwner(target, index, ownerId) {
    if (!ownerId) return;
    const next = assignmentOwnerIds(target);
    next[index] = ownerId;
    updateAssignmentOwners(target, next);
  }

  function removeAssignmentOwner(target, ownerId) {
    if (target.senderLocked) return;
    const next = assignmentOwnerIds(target).filter((id) => id !== ownerId);
    updateAssignmentOwners(target, next);
  }

  function deleteAssignment(target) {
    setAssignments((current) =>
      current.filter((assignment) => !sameAssignment(assignment, target))
    );
  }

  function updateAssignment(target, field, value) {
    setAssignments((current) =>
      current.map((assignment) =>
        sameAssignment(assignment, target)
          ? {
              ...assignment,
              [field]: value
            }
          : assignment
      )
    );
  }

  async function loadPersonaOptionsForAudience(audienceListId) {
    if (!campaignApiUrl || !audienceListId || personaOptionsByAudience[audienceListId]) return;
    setPersonaOptionsByAudience((current) => ({
      ...current,
      [audienceListId]: { loading: true, none: 0, options: [], total: 0 }
    }));
    try {
      const params = new URLSearchParams({ facet: "persona", listId: audienceListId });
      const response = await fetch(`${campaignApiUrl}/audience-contacts?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Persona lookup failed: ${response.status}`);
      setPersonaOptionsByAudience((current) => ({
        ...current,
        [audienceListId]: {
          loading: false,
          none: result.none || 0,
          options: result.options || [],
          total: result.total || 0
        }
      }));
    } catch (error) {
      setPersonaOptionsByAudience((current) => ({
        ...current,
        [audienceListId]: { error: error.message, loading: false, none: 0, options: [], total: 0 }
      }));
    }
  }

  function updateAssignmentPlaceholder(target, key, value) {
    setAssignments((current) =>
      current.map((assignment) =>
        sameAssignment(assignment, target)
          ? {
              ...assignment,
              placeholderValues: {
                ...assignment.placeholderValues,
                [key]: value
              }
            }
          : assignment
      )
    );
  }

  function assignmentKey(assignment) {
    return `${assignment.emailId}:${assignment.campaignId}:${assignment.stepKey}`;
  }

  function sendModeLabel(mode = "manual_review") {
    if (mode === "calendar_manual") return "Calendar manual task";
    if (mode === "calendar_auto") return "Calendar automatic send";
    return "Manual review";
  }

  async function createReviewRun(assignment) {
    if (!campaignApiUrl) {
      setSendRunFeedback((current) => ({
        ...current,
        [assignmentKey(assignment)]: { type: "error", message: "The hosted API is required to create a send review run." }
      }));
      return;
    }
    const audienceListId = selectedAudienceListIdForAssignment(assignment);
    if (!audienceListId) {
      setSendRunFeedback((current) => ({
        ...current,
        [assignmentKey(assignment)]: { type: "error", message: "Assign a reusable audience list to this campaign first." }
      }));
      return;
    }
    setSendRunFeedback((current) => ({
      ...current,
      [assignmentKey(assignment)]: { type: "loading", message: "Creating review run..." }
    }));
    try {
      const response = await fetch(`${campaignApiUrl}/send-runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          audienceListId,
          campaignId: assignment.campaignId,
          mode: assignment.sendMode || "manual_review",
          recordLimit: 1000,
          sampleLimit: 5,
          sendDate: assignment.sendDate || tomorrowInputDate(),
          sendWindow: assignment.sendWindow || "09:00-11:00",
          stepKey: assignment.stepKey,
          timezone: assignment.timezone || userTimezone(),
          personaFilter: normalizePersonaFilter(assignment.personaFilter || assignment.persona || "ALL")
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Send run failed: ${response.status}`);
      setSendRuns((current) => [result.sendRun, ...current.filter((run) => run.sendRunId !== result.sendRun.sendRunId)].slice(0, 25));
      setSendRunFeedback((current) => ({
        ...current,
        [assignmentKey(assignment)]: {
          type: "success",
          message: `Review run ready: ${result.sendRun.counts.eligible.toLocaleString()} queued, ${result.sendRun.counts.skipped.toLocaleString()} skipped.`,
          result
        }
      }));
    } catch (error) {
      setSendRunFeedback((current) => ({
        ...current,
        [assignmentKey(assignment)]: { type: "error", message: error.message }
      }));
    }
  }

  return (
    <div className="email-workspace">
      <section className="panel schema-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">AWS source of truth</p>
            <h2>DynamoDB email model</h2>
          </div>
          <Database size={20} />
        </div>
        <div className="schema-grid">
          {emailTablePlan.map((item) => (
            <div className="schema-card" key={item.table}>
              <strong>{item.table}</strong>
              <span>{item.key}</span>
              <p>{item.purpose}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel email-library">
        <div className="panel-head">
          <h3>Email library</h3>
          <button className="icon-button compact" title="Create email" onClick={() => createTemplate()}>
            <Plus size={16} />
          </button>
        </div>
        <label className="email-library-filter">
          <span>Filter by campaign</span>
          <select value={emailCampaignFilter} onChange={(event) => setEmailCampaignFilter(event.target.value)}>
            <option value="unassigned">Unassigned</option>
            <option value="all">All emails</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
            ))}
          </select>
        </label>
        <div className="email-list">
          {filteredTemplates.map((template) => {
            const usageCount = assignments.filter((assignment) => assignment.emailId === template.emailId).length;
            return (
              <button
                className={template.emailId === selectedTemplate?.emailId ? "selected" : ""}
                key={template.emailId}
                onClick={() => setSelectedEmailId(template.emailId)}
              >
                <strong>{template.label}</strong>
                <span>{template.internalRef}</span>
                <small>{template.status} · used by {usageCount} campaign{usageCount === 1 ? "" : "s"}</small>
              </button>
            );
          })}
          {!filteredTemplates.length && <p className="empty-library-note">No emails match this filter.</p>}
        </div>
      </section>

      {selectedTemplate ? (
      <>
      <section className="panel email-editor">
        <div className="section-head">
          <div>
            <p className="eyebrow">Reusable campaign email</p>
            <h2>{selectedTemplate?.label}</h2>
          </div>
          <div className="editor-actions">
            <button className="icon-button compact" title="Clone email" onClick={cloneTemplate}>
              <Copy size={16} />
            </button>
            <button className="primary-button compact" title="Stored locally for now">
              <Save size={16} />
              Saved
            </button>
          </div>
        </div>

        {selectedTemplate && (
          <div className="email-form">
            <label>
              <span>Internal reference</span>
              <input value={selectedTemplate.internalRef} onChange={(event) => updateTemplate("internalRef", event.target.value)} />
            </label>
            <label>
              <span>User label</span>
              <input value={selectedTemplate.label} onChange={(event) => updateTemplate("label", event.target.value)} />
            </label>
            <label>
              <span>Subject</span>
              <input value={selectedTemplate.subject} onChange={(event) => updateTemplate("subject", event.target.value)} />
            </label>
            <label>
              <span>Status</span>
              <select value={selectedTemplate.status} onChange={(event) => updateTemplate("status", event.target.value)}>
                <option value="draft">draft</option>
                <option value="approved">approved</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label className="body-field">
              <span>Body text</span>
              <textarea value={selectedTemplate.bodyText} onChange={(event) => updateTemplate("bodyText", event.target.value)} />
            </label>
            <div className="placeholder-row">
              {detectedPlaceholders.map((key) => (
                <span key={key}>{`{{${key}}}`}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="panel assignment-panel">
        <div className="panel-head">
          <h3>Campaign mapping</h3>
          <button className="primary-button compact" onClick={() => setAssignDialogOpen(true)}>
            <Plus size={15} />
            Assign
          </button>
        </div>
        {assignDialogOpen && (
          <div className="modal-backdrop" role="presentation">
            <section className="panel assign-campaign-modal" role="dialog" aria-modal="true" aria-label="Assign email to campaign">
              <div className="section-head">
                <div>
                  <p className="eyebrow">New campaign mapping</p>
                  <h2>Assign this email</h2>
                </div>
                <button className="icon-button compact" title="Close" onClick={() => setAssignDialogOpen(false)}>
                  <X size={15} />
                </button>
              </div>
              <p className="modal-helper-text">Choose the campaign this reusable email should be mapped to. Audience and persona are configured on the assignment row after it is created.</p>
              <label className="assignment-campaign-picker">
                <span>Campaign</span>
                <select value={activeCampaignId} onChange={(event) => setActiveCampaignId(event.target.value)}>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
                  ))}
                </select>
              </label>
              <div className="editor-actions modal-actions">
                <button className="secondary-button" onClick={() => setAssignDialogOpen(false)}>Cancel</button>
                <button className="primary-button" onClick={assignToCampaign} disabled={!activeCampaign}>
                  <Plus size={15} />
                  Create assignment
                </button>
              </div>
            </section>
          </div>
        )}
        <div className="assignment-list">
          {selectedAssignments.map((assignment) => {
            const campaign = campaigns.find((item) => item.id === assignment.campaignId);
            const senderIds = assignmentOwnerIds(assignment);
            const availableOwnerProfiles = ownerProfiles.filter((profile) => !senderIds.includes(profile.ownerId));
            const splitLabel = senderSplitLabel(senderIds.length);
            const key = assignmentKey(assignment);
            const assignedAudienceLists = campaignAssignedAudienceLists(assignment.campaignId);
            const selectedAudienceListId = selectedAudienceListIdForAssignment(assignment);
            const savedAudienceIsAssigned = assignment.audienceListId && assignedAudienceLists.some((list) => list.listId === assignment.audienceListId);
            const invalidSavedAudience = assignment.audienceListId && !savedAudienceIsAssigned
              ? reusableAudienceLists.find((list) => list.listId === assignment.audienceListId)
              : null;
            const personaFacet = personaOptionsByAudience[selectedAudienceListId] || { none: 0, options: [], total: 0 };
            const selectedPersonaFilter = normalizePersonaFilter(assignment.personaFilter || assignment.persona || "ALL");
            const feedback = sendRunFeedback[key];
            return (
              <article className="assignment-card" key={`${assignment.emailId}-${assignment.campaignId}-${assignment.stepKey}`}>
                <div className="assignment-card-heading">
                  <div>
                    <strong>{campaign?.shortName || assignment.campaignId}</strong>
                    <span>{assignment.stepKey} · {personaFilterLabel(selectedPersonaFilter)} · {senderIds.length} sender{senderIds.length === 1 ? "" : "s"} · equal split</span>
                  </div>
                  <button className="icon-button compact danger" title="Remove campaign assignment" onClick={() => deleteAssignment(assignment)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <label>
                  <span>Label</span>
                  <input value={assignment.label} onChange={(event) => updateAssignment(assignment, "label", event.target.value)} />
                </label>
                <div className="assignment-targeting-grid">
                  <label className="assignment-targeting-control">
                    <span>Campaign audience</span>
                    <select
                      value={selectedAudienceListId}
                      onFocus={() => loadPersonaOptionsForAudience(selectedAudienceListId)}
                      onChange={(event) => {
                        setSelectedAudienceByAssignment((current) => ({ ...current, [key]: event.target.value }));
                        updateAssignment(assignment, "audienceListId", event.target.value);
                        updateAssignment(assignment, "personaFilter", "ALL");
                        loadPersonaOptionsForAudience(event.target.value);
                      }}
                      disabled={!assignedAudienceLists.length}
                    >
                      {!assignedAudienceLists.length && <option value="">No audience assigned to {campaign?.shortName || "this campaign"}</option>}
                      {assignedAudienceLists.map((list) => (
                        <option key={list.listId} value={list.listId}>{list.name}</option>
                      ))}
                    </select>
                  </label>
                  <small className="assignment-targeting-help">
                    {invalidSavedAudience
                      ? `Saved audience "${invalidSavedAudience.name}" is not assigned to ${campaign?.shortName || "this campaign"}.`
                      : assignedAudienceLists.length
                        ? `Showing ${assignedAudienceLists.length} audience${assignedAudienceLists.length === 1 ? "" : "s"} assigned to ${campaign?.shortName || "this campaign"}.`
                        : `Assign a reusable audience to ${campaign?.shortName || "this campaign"} on the Audience page.`}
                  </small>
                  <label className="assignment-targeting-control">
                    <span>Persona</span>
                    <select
                      value={selectedPersonaFilter}
                      onFocus={() => loadPersonaOptionsForAudience(selectedAudienceListId)}
                      onChange={(event) => updateAssignment(assignment, "personaFilter", event.target.value)}
                      disabled={!selectedAudienceListId}
                    >
                      <option value="ALL">ALL{personaFacet.total ? ` (${personaFacet.total.toLocaleString()})` : ""}</option>
                      <option value="__NONE__">UNSET{personaFacet.none ? ` (${personaFacet.none.toLocaleString()})` : ""}</option>
                      {personaFacet.options.map((option) => (
                        <option key={option.value} value={option.value}>{option.value}{option.count ? ` (${option.count.toLocaleString()})` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <small className="assignment-targeting-help">{personaFacet.loading ? "Loading personas..." : personaFacet.error || "Defaults to ALL if no persona is selected."}</small>
                </div>
                <div className="sender-roster">
                  <div>
                    <span>Senders</span>
                    <small>{assignment.senderLocked ? "Locked after first send. Replace only." : `Contacts will be split evenly, ${splitLabel} each.`}</small>
                  </div>
                  {senderIds.map((ownerId, index) => {
                    const sender = ownerProfileMap[ownerId] || ownerProfiles[0];
                    const replacementOptions = ownerProfiles.filter((profile) => profile.ownerId === ownerId || !senderIds.includes(profile.ownerId));
                    return (
                      <div className="sender-slot" key={`${assignment.emailId}-${assignment.campaignId}-${assignment.stepKey}-${ownerId}-${index}`}>
                        <select value={ownerId} onChange={(event) => replaceAssignmentOwner(assignment, index, event.target.value)}>
                          {replacementOptions.map((profile) => (
                            <option key={profile.ownerId} value={profile.ownerId}>{profile.name}</option>
                          ))}
                        </select>
                        <span>{splitLabel}</span>
                        <button className="icon-button compact danger" title={assignment.senderLocked ? "Sender roster is locked; replace this sender instead" : "Remove sender"} onClick={() => removeAssignmentOwner(assignment, ownerId)} disabled={assignment.senderLocked}>
                          <Trash2 size={13} />
                        </button>
                        <small>{sender?.email || "No sender email"}</small>
                      </div>
                    );
                  })}
                  {!senderIds.length && <p className="sender-empty-note">No sender assigned. Add at least one sender before sending.</p>}
                  <div className="sender-add-row">
                    <select value="" onChange={(event) => addAssignmentOwner(assignment, event.target.value)} disabled={assignment.senderLocked || !availableOwnerProfiles.length}>
                      <option value="">{assignment.senderLocked ? "Sender list locked" : "Add sender..."}</option>
                      {availableOwnerProfiles.map((profile) => (
                        <option key={profile.ownerId} value={profile.ownerId}>{profile.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label>
                  <span>Website link</span>
                  <input value={assignment.placeholderValues?.WEBSITE_LINK || ""} onChange={(event) => updateAssignmentPlaceholder(assignment, "WEBSITE_LINK", event.target.value)} />
                </label>
                <div className="resolved-owner-card">
                  <span>Routing rule</span>
                  <strong>{assignment.senderLocked ? "Sender split locked" : "Equal sender split pending first send"}</strong>
                  <small>{senderIds.map((id) => ownerProfileMap[id]?.name || id).join(" / ")}</small>
                  <em>{`{{CALENDAR_LINK}} uses the assigned employee for each contact`}</em>
                </div>
                <label className="toggle-row">
                  <input type="checkbox" checked={Boolean(assignment.senderLocked)} onChange={(event) => updateAssignment(assignment, "senderLocked", event.target.checked)} />
                  <span>First send recorded - lock sender roster</span>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" checked={assignment.enabled} onChange={(event) => updateAssignment(assignment, "enabled", event.target.checked)} />
                  <span>Enabled for Lambda send</span>
                </label>
                <div className="send-control-panel">
                  <div className="send-control-head">
                    <div>
                      <span>Send control</span>
                      <strong>{sendModeLabel(assignment.sendMode)}</strong>
                    </div>
                    <button className="primary-button compact" onClick={() => createReviewRun(assignment)} disabled={!assignment.enabled || !selectedAudienceListId || feedback?.type === "loading"}>
                      <PlayCircle size={15} />
                      {feedback?.type === "loading" ? "Preparing" : "Create review run"}
                    </button>
                  </div>
                  <div className="send-control-grid">
                    <label>
                      <span>Mode</span>
                      <select value={assignment.sendMode || "manual_review"} onChange={(event) => updateAssignment(assignment, "sendMode", event.target.value)}>
                        <option value="manual_review">Manual review only</option>
                        <option value="calendar_manual">Calendar creates manual send task</option>
                        <option value="calendar_auto">Calendar automatic send later</option>
                      </select>
                    </label>
                    <label>
                      <span>Scheduled date</span>
                      <input type="date" value={assignment.sendDate || tomorrowInputDate()} onChange={(event) => updateAssignment(assignment, "sendDate", event.target.value)} />
                    </label>
                    <label>
                      <span>Send window</span>
                      <input value={assignment.sendWindow || "09:00-11:00"} onChange={(event) => updateAssignment(assignment, "sendWindow", event.target.value)} />
                    </label>
                    <label>
                      <span>Timezone</span>
                      <input value={assignment.timezone || userTimezone()} onChange={(event) => updateAssignment(assignment, "timezone", event.target.value)} />
                    </label>
                  </div>
                  <div className="send-toggle-row">
                    <label className="toggle-row">
                      <input type="checkbox" checked={assignment.requiresApproval !== false} onChange={(event) => updateAssignment(assignment, "requiresApproval", event.target.checked)} />
                      <span>Requires approval before send</span>
                    </label>
                    <label className="toggle-row">
                      <input type="checkbox" checked={Boolean(assignment.autoSendEnabled)} onChange={(event) => updateAssignment(assignment, "autoSendEnabled", event.target.checked)} />
                      <span>Allow automatic send later</span>
                    </label>
                  </div>
                  {feedback && (
                    <div className={`send-run-feedback ${feedback.type}`}>
                      <strong>{feedback.message}</strong>
                      {feedback.result?.previewRecipients?.length ? (
                        <div className="send-run-preview-list">
                          {feedback.result.previewRecipients.map((recipient) => (
                            <article key={`${key}-${recipient.email}`}>
                              <span>{recipient.email} · {recipient.senderName || recipient.ownerId}</span>
                              <strong>{recipient.subject}</strong>
                              <p>{recipient.bodyText}</p>
                            </article>
                          ))}
                        </div>
                      ) : null}
                      {feedback.result?.sendRun?.recordLimitApplied && (
                        <small>Recipient records were capped at {feedback.result.sendRun.recordsSaved.toLocaleString()} for this review run; counts still cover the full audience.</small>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {!selectedAssignments.length && (
            <p className="empty-library-note">This email is not assigned to any campaigns yet. Use Assign to create the first mapping.</p>
          )}
          {!!sendRuns.length && (
            <div className="recent-send-runs">
              <strong>Recent review runs</strong>
              {sendRuns.slice(0, 4).map((run) => (
                <article key={run.sendRunId}>
                  <span>{run.emailLabel || run.emailId} · {run.stepKey}</span>
                  <small>{new Date(run.createdAt).toLocaleString()} · {run.counts?.eligible?.toLocaleString?.() || 0} queued · {run.counts?.skipped?.toLocaleString?.() || 0} skipped</small>
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
      </>
      ) : (
        <section className="panel email-empty-state">
          <p className="eyebrow">Reusable campaign email</p>
          <h2>No emails match this filter</h2>
          <p>Create a new email from here, then assign it to the right campaign mapping.</p>
          <button className="primary-button" onClick={() => createTemplate()}>
            <Plus size={15} />
            Add new email
          </button>
        </section>
      )}
    </div>
  );
}

function PlaybookWorkspace({ campaigns, playbooks, setDeletedPlaybookIds, setPlaybooks }) {
  const [selectedPlaybookId, setSelectedPlaybookId] = useState(() => playbooks[0]?.playbookId || initialPlaybooks[0].playbookId);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const selectedPlaybook = playbooks.find((playbook) => playbook.playbookId === selectedPlaybookId) || playbooks[0] || initialPlaybooks[0];
  const selectedRule = selectedPlaybook.rules?.find((rule) => rule.ruleId === selectedRuleId) || selectedPlaybook.rules?.[0] || null;
  const assignedCampaigns = campaigns.filter((campaign) => (selectedPlaybook.assignedCampaignIds || []).includes(campaign.id));
  const unassignedCampaigns = campaigns.filter((campaign) => !(selectedPlaybook.assignedCampaignIds || []).includes(campaign.id));

  useEffect(() => {
    if (!playbooks.some((playbook) => playbook.playbookId === selectedPlaybookId) && playbooks[0]) setSelectedPlaybookId(playbooks[0].playbookId);
  }, [playbooks, selectedPlaybookId]);

  useEffect(() => {
    if (!selectedPlaybook?.rules?.some((rule) => rule.ruleId === selectedRuleId)) setSelectedRuleId(selectedPlaybook?.rules?.[0]?.ruleId || "");
  }, [selectedPlaybook?.playbookId, selectedPlaybook?.rules?.length, selectedRuleId]);

  function updatePlaybook(patch) {
    setPlaybooks((current) => current.map((playbook) =>
      playbook.playbookId === selectedPlaybook.playbookId
        ? { ...playbook, ...patch, updatedAt: nowIso() }
        : playbook
    ));
  }

  function createPlaybook() {
    const playbookId = `playbook-${Date.now()}`;
    const next = {
      ...cloneJson(initialPlaybooks[0]),
      playbookId,
      name: "New orchestration playbook",
      description: "Reusable conditional rules for manual follow-up and suppression.",
      assignedCampaignIds: [],
      campaignOverrides: {},
      rules: [],
      updatedAt: nowIso()
    };
    setPlaybooks((current) => [next, ...current]);
    setSelectedPlaybookId(playbookId);
    setSelectedRuleId("");
  }

  function clonePlaybook() {
    const playbookId = `playbook-${Date.now()}`;
    const next = {
      ...cloneJson(selectedPlaybook),
      playbookId,
      name: `${selectedPlaybook.name} copy`,
      assignedCampaignIds: [],
      campaignOverrides: {},
      updatedAt: nowIso()
    };
    setPlaybooks((current) => [next, ...current]);
    setSelectedPlaybookId(playbookId);
  }

  function deletePlaybook() {
    if (playbooks.length <= 1) return;
    setDeletedPlaybookIds((current) => Array.from(new Set([...current, selectedPlaybook.playbookId])));
    setPlaybooks((current) => current.filter((playbook) => playbook.playbookId !== selectedPlaybook.playbookId));
    setSelectedPlaybookId(playbooks.find((playbook) => playbook.playbookId !== selectedPlaybook.playbookId)?.playbookId || "");
  }

  function addRule() {
    const ruleId = `rule-${Date.now()}`;
    const nextRule = {
      ruleId,
      enabled: true,
      name: "New conditional rule",
      trigger: "email.clicked",
      conditions: [],
      action: { type: "create_task", channel: "call", dueInBusinessDays: 1, owner: "campaign_assigned_owner" }
    };
    updatePlaybook({ rules: [...(selectedPlaybook.rules || []), nextRule] });
    setSelectedRuleId(ruleId);
  }

  function updateRule(ruleId, patch) {
    updatePlaybook({
      rules: (selectedPlaybook.rules || []).map((rule) =>
        rule.ruleId === ruleId ? { ...rule, ...patch } : rule
      )
    });
  }

  function updateRuleAction(ruleId, patch) {
    updatePlaybook({
      rules: (selectedPlaybook.rules || []).map((rule) =>
        rule.ruleId === ruleId ? { ...rule, action: { ...rule.action, ...patch } } : rule
      )
    });
  }

  function deleteRule(ruleId) {
    updatePlaybook({
      rules: (selectedPlaybook.rules || []).filter((rule) => rule.ruleId !== ruleId),
      campaignOverrides: Object.fromEntries(
        Object.entries(selectedPlaybook.campaignOverrides || {}).map(([campaignId, override]) => [
          campaignId,
          {
            ...override,
            disabledRuleIds: (override.disabledRuleIds || []).filter((id) => id !== ruleId)
          }
        ])
      )
    });
  }

  function addCondition(rule) {
    updateRule(rule.ruleId, {
      conditions: [
        ...(rule.conditions || []),
        { field: "persona", operator: "equals", value: "" }
      ]
    });
  }

  function updateCondition(rule, index, patch) {
    updateRule(rule.ruleId, {
      conditions: (rule.conditions || []).map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...patch } : condition
      )
    });
  }

  function deleteCondition(rule, index) {
    updateRule(rule.ruleId, {
      conditions: (rule.conditions || []).filter((_, conditionIndex) => conditionIndex !== index)
    });
  }

  function toggleCampaignAssignment(campaignId, checked) {
    const assignedCampaignIds = checked
      ? Array.from(new Set([...(selectedPlaybook.assignedCampaignIds || []), campaignId]))
      : (selectedPlaybook.assignedCampaignIds || []).filter((id) => id !== campaignId);
    const campaignOverrides = { ...(selectedPlaybook.campaignOverrides || {}) };
    if (!checked) delete campaignOverrides[campaignId];
    updatePlaybook({ assignedCampaignIds, campaignOverrides });
  }

  function toggleCampaignRuleOverride(campaignId, ruleId, disabled) {
    const currentOverride = selectedPlaybook.campaignOverrides?.[campaignId] || {};
    const currentDisabled = currentOverride.disabledRuleIds || [];
    const disabledRuleIds = disabled
      ? Array.from(new Set([...currentDisabled, ruleId]))
      : currentDisabled.filter((id) => id !== ruleId);
    updatePlaybook({
      campaignOverrides: {
        ...(selectedPlaybook.campaignOverrides || {}),
        [campaignId]: {
          ...currentOverride,
          disabledRuleIds,
          updatedAt: nowIso()
        }
      }
    });
  }

  function ruleSummary(rule) {
    const triggerLabel = optionLabel(playbookTriggerOptions, rule.trigger);
    const actionLabel = optionLabel(playbookActionTypes, rule.action?.type);
    const channelLabel = optionLabel(playbookActionChannels, rule.action?.channel);
    const conditionText = rule.conditions?.length ? `${rule.conditions.length} condition${rule.conditions.length === 1 ? "" : "s"}` : "no conditions";
    return `When ${triggerLabel}, with ${conditionText}, then ${actionLabel}${channelLabel && channelLabel !== "No channel" ? `: ${channelLabel}` : ""}`;
  }

  return (
    <div className="playbook-workspace">
      <section className="panel playbook-library">
        <div className="panel-head">
          <h3>Playbooks</h3>
          <button className="icon-button compact" title="Create playbook" onClick={createPlaybook}>
            <Plus size={16} />
          </button>
        </div>
        <div className="playbook-list">
          {playbooks.map((playbook) => (
            <button
              key={playbook.playbookId}
              className={playbook.playbookId === selectedPlaybook.playbookId ? "selected" : ""}
              onClick={() => setSelectedPlaybookId(playbook.playbookId)}
            >
              <strong>{playbook.name}</strong>
              <span>{playbook.rules?.length || 0} rules · {(playbook.assignedCampaignIds || []).length} campaigns</span>
              <small>{playbook.status || "active"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel playbook-editor">
        <div className="section-head">
          <div>
            <p className="eyebrow">Reusable orchestration logic</p>
            <h2>{selectedPlaybook.name}</h2>
          </div>
          <div className="editor-actions">
            <button className="icon-button compact" title="Clone playbook" onClick={clonePlaybook}>
              <Copy size={15} />
            </button>
            <button className="icon-button compact danger" title="Delete playbook" onClick={deletePlaybook} disabled={playbooks.length <= 1}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div className="playbook-form">
          <label>
            <span>Name</span>
            <input value={selectedPlaybook.name || ""} onChange={(event) => updatePlaybook({ name: event.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select value={selectedPlaybook.status || "active"} onChange={(event) => updatePlaybook({ status: event.target.value })}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="wide-field">
            <span>Description</span>
            <textarea value={selectedPlaybook.description || ""} onChange={(event) => updatePlaybook({ description: event.target.value })} />
          </label>
        </div>
        <div className="playbook-rules-head">
          <div>
            <h3>Rules</h3>
            <span>Rules are structured data: trigger, conditions, action, owner, and due date.</span>
          </div>
          <button className="primary-button compact" onClick={addRule}>
            <Plus size={15} />
            Rule
          </button>
        </div>
        <div className="playbook-rule-layout">
          <div className="playbook-rule-list">
            {(selectedPlaybook.rules || []).map((rule) => (
              <button
                key={rule.ruleId}
                className={rule.ruleId === selectedRule?.ruleId ? "selected" : ""}
                onClick={() => setSelectedRuleId(rule.ruleId)}
              >
                <strong>{rule.name}</strong>
                <span>{ruleSummary(rule)}</span>
                <small>{rule.enabled ? "Enabled" : "Disabled"}</small>
              </button>
            ))}
            {!selectedPlaybook.rules?.length && <p>No rules yet. Add one to begin defining this playbook.</p>}
          </div>
          {selectedRule && (
            <article className="playbook-rule-editor">
              <div className="playbook-rule-title">
                <label className="toggle-row playbook-enabled-callout">
                  <input type="checkbox" checked={selectedRule.enabled !== false} onChange={(event) => updateRule(selectedRule.ruleId, { enabled: event.target.checked })} />
                  <span>Rule enabled</span>
                </label>
                <button className="icon-button compact danger" title="Delete rule" onClick={() => deleteRule(selectedRule.ruleId)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <label>
                <span>Rule name</span>
                <input value={selectedRule.name || ""} onChange={(event) => updateRule(selectedRule.ruleId, { name: event.target.value })} />
              </label>
              <label>
                <span>When this happens</span>
                <select value={selectedRule.trigger || "email.clicked"} onChange={(event) => updateRule(selectedRule.ruleId, { trigger: event.target.value })}>
                  {playbookTriggerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="playbook-condition-head">
                <strong>Conditions</strong>
                <button className="icon-button compact" title="Add condition" onClick={() => addCondition(selectedRule)}>
                  <Plus size={14} />
                </button>
              </div>
              {(selectedRule.conditions || []).map((condition, index) => (
                <div className="playbook-condition-row" key={`${selectedRule.ruleId}-condition-${index}`}>
                  <select value={condition.field || "persona"} onChange={(event) => updateCondition(selectedRule, index, { field: event.target.value })}>
                    {playbookConditionFields.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select value={condition.operator || "equals"} onChange={(event) => updateCondition(selectedRule, index, { operator: event.target.value })}>
                    {playbookOperators.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input value={condition.value || ""} onChange={(event) => updateCondition(selectedRule, index, { value: event.target.value })} placeholder="Value, comma-separated if needed" />
                  <button className="icon-button compact danger" title="Remove condition" onClick={() => deleteCondition(selectedRule, index)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {!selectedRule.conditions?.length && <p className="playbook-empty-note">No conditions means this fires whenever the trigger occurs.</p>}
              <div className="playbook-action-grid">
                <label>
                  <span>Then do this</span>
                  <select value={selectedRule.action?.type || "create_task"} onChange={(event) => updateRuleAction(selectedRule.ruleId, { type: event.target.value })}>
                    {playbookActionTypes.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Channel</span>
                  <select value={selectedRule.action?.channel || "call"} onChange={(event) => updateRuleAction(selectedRule.ruleId, { channel: event.target.value })}>
                    {playbookActionChannels.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Due in business days</span>
                  <input type="number" min="0" value={selectedRule.action?.dueInBusinessDays ?? 0} onChange={(event) => updateRuleAction(selectedRule.ruleId, { dueInBusinessDays: Number(event.target.value || 0) })} />
                </label>
                <label>
                  <span>Owner</span>
                  <select value={selectedRule.action?.owner || "campaign_assigned_owner"} onChange={(event) => updateRuleAction(selectedRule.ruleId, { owner: event.target.value })}>
                    {playbookOwnerRules.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          )}
        </div>
      </section>

      <aside className="panel playbook-assignment-panel">
        <div className="panel-head">
          <h3>Campaign assignment</h3>
          <span>{assignedCampaigns.length} assigned</span>
        </div>
        <div className="playbook-campaign-list">
          {[...assignedCampaigns, ...unassignedCampaigns].map((campaign) => {
            const checked = (selectedPlaybook.assignedCampaignIds || []).includes(campaign.id);
            const override = selectedPlaybook.campaignOverrides?.[campaign.id] || {};
            return (
              <article className={checked ? "assigned" : ""} key={campaign.id}>
                <label className="toggle-row">
                  <input type="checkbox" checked={checked} onChange={(event) => toggleCampaignAssignment(campaign.id, event.target.checked)} />
                  <span>{campaign.shortName || campaign.name}</span>
                </label>
                {checked && (
                  <div className="campaign-rule-overrides">
                    <strong>Disable rules for this campaign</strong>
                    {(selectedPlaybook.rules || []).map((rule) => (
                      <label className="toggle-row" key={`${campaign.id}-${rule.ruleId}`}>
                        <input
                          type="checkbox"
                          checked={(override.disabledRuleIds || []).includes(rule.ruleId)}
                          onChange={(event) => toggleCampaignRuleOverride(campaign.id, rule.ruleId, event.target.checked)}
                        />
                        <span>{rule.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function Setup({ activeCampaign, campaigns, createCampaignFromSetup, setActiveCampaignId, updateCampaignFromSetup }) {
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState({
    name: "",
    shortName: "",
    objective: "",
    personas: "",
    budget: "",
    startDate: "2026-05-01",
    plannedContacts: "",
    meetings: "",
    pipeline: "",
    channelTypes: ["email", "call", "landing"]
  });
  const [importStatus, setImportStatus] = useState("");
  const setupBlocks = [
    ["Campaign definition", "Objective, market, AWS program, budget, dates, languages, landing pages"],
    ["Audience and source lists", "HubSpot lists, Google Sheet imports, ICP rules, exclusions, consent status"],
    ["Channel cadence", "Email waves, WhatsApp nudges, call tasks, LinkedIn posts, webinar moments"],
    ["Content rules", "Tone, claims, AWS/MDF constraints, Arabic variants, approval owners"],
    ["Measurement plan", "UTMs, conversion goals, influenced revenue, HubSpot stages, weekly review owner"]
  ];

  function updateCampaignDraft(field, value) {
    setCampaignDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleDraftChannel(type, checked) {
    setCampaignDraft((current) => ({
      ...current,
      channelTypes: checked
        ? Array.from(new Set([...(current.channelTypes || []), type]))
        : (current.channelTypes || []).filter((item) => item !== type)
    }));
  }

  function submitCampaignDraft() {
    createCampaignFromSetup(campaignDraft);
    setShowBriefModal(false);
    setImportStatus(`Created draft campaign: ${campaignDraft.shortName || campaignDraft.name || "New campaign"}`);
    setCampaignDraft((current) => ({
      ...current,
      name: "",
      shortName: "",
      objective: "",
      personas: "",
      budget: "",
      plannedContacts: "",
      meetings: "",
      pipeline: ""
    }));
  }

  async function parseMarkdownCampaign(files) {
    const fileList = Array.from(files || []);
    if (!fileList.length) return null;
    const fileTexts = await Promise.all(fileList.map(async (file) => ({ name: file.name, text: await file.text() })));
    const combined = fileTexts.map((file) => file.text).join("\n\n");
    const heading = combined.match(/^#\s+(.+)$/m)?.[1] || combined.match(/^##\s+(.+)$/m)?.[1] || fileList[0].name.replace(/\.md$/i, "");
    const objective = combined.match(/objective[:\-\s]+(.+)/i)?.[1] || combined.split(/\n/).find((line) => line.trim().length > 90)?.trim() || "";
    return {
      name: heading,
      shortName: heading.replace(/\s+overview$/i, ""),
      objective,
      personas: "",
      budget: "",
      startDate: campaignDraft.startDate,
      plannedContacts: "",
      meetings: "",
      pipeline: "",
      channelTypes: ["email", "call", "landing"],
      files: fileList.map((file) => file.name),
      folder: slugify(heading)
    };
  }

  async function importMarkdownCampaign(files) {
    setImportStatus("Reading Markdown campaign files...");
    try {
      const fileList = Array.from(files || []);
      const parsedCampaign = await parseMarkdownCampaign(files);
      if (!parsedCampaign) return;
      createCampaignFromSetup(parsedCampaign);
      setImportStatus(`Imported ${fileList.length} Markdown file${fileList.length === 1 ? "" : "s"} into a draft campaign.`);
    } catch (error) {
      setImportStatus(error.message);
    }
  }

  async function updateMarkdownCampaign(files) {
    if (!activeCampaign?.id) {
      setImportStatus("Select an existing campaign before updating from Markdown.");
      return;
    }
    setImportStatus(`Reading Markdown files for ${activeCampaign.shortName || activeCampaign.name}...`);
    try {
      const fileList = Array.from(files || []);
      const parsedCampaign = await parseMarkdownCampaign(fileList);
      if (!parsedCampaign) return;
      updateCampaignFromSetup(activeCampaign.id, parsedCampaign);
      setImportStatus(`Updated ${activeCampaign.shortName || activeCampaign.name} from ${fileList.length} Markdown file${fileList.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setImportStatus(error.message);
    }
  }

  return (
    <div className="setup-layout">
      <section className="panel setup-main">
        <div className="section-head">
          <div>
            <p className="eyebrow">Campaign setup workbook</p>
            <h2>{activeCampaign?.name || "Campaign setup"}</h2>
          </div>
          <div className="editor-actions">
            <select value={activeCampaign?.id || ""} onChange={(event) => setActiveCampaignId(event.target.value)}>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
              ))}
            </select>
            <button className="primary-button compact" onClick={() => setShowBriefModal(true)}>
              <Wand2 size={16} />
              Generate brief
            </button>
          </div>
        </div>
        <div className="setup-action-row">
          <label className="markdown-import-button">
            <FileText size={15} />
            Update campaign from MD
            <input
              type="file"
              accept=".md,text/markdown"
              multiple
              onChange={(event) => {
                updateMarkdownCampaign(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <span>{importStatus || "Create a new campaign from Generate brief, or update the selected campaign from Markdown source files."}</span>
        </div>
        <div className="setup-form">
          {setupBlocks.map(([label, hint]) => (
            <label key={label}>
              <span>{label}</span>
              <textarea defaultValue={hint} />
            </label>
          ))}
        </div>
      </section>
      <aside className="panel">
        <h3>Source files accounted for</h3>
        <div className="file-list">
          {(activeCampaign?.files || []).map((file) => (
            <span key={file}>
              <FileText size={14} />
              {file}
            </span>
          ))}
        </div>
      </aside>
      {showBriefModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="panel campaign-brief-modal" role="dialog" aria-modal="true" aria-label="Generate campaign brief">
            <div className="section-head">
              <div>
                <p className="eyebrow">New campaign</p>
                <h2>Generate campaign brief</h2>
              </div>
              <button className="icon-button compact" title="Close" onClick={() => setShowBriefModal(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="setup-action-row modal-import-row">
              <label className="markdown-import-button">
                <FileText size={15} />
                Import campaign from MD
                <input
                  type="file"
                  accept=".md,text/markdown"
                  multiple
                  onChange={(event) => {
                    importMarkdownCampaign(event.target.files);
                    event.target.value = "";
                    setShowBriefModal(false);
                  }}
                />
              </label>
              <span>Use Markdown files to seed a brand new draft campaign.</span>
            </div>
            <div className="campaign-brief-form">
              <label>
                <span>Campaign name</span>
                <input value={campaignDraft.name} onChange={(event) => updateCampaignDraft("name", event.target.value)} placeholder="Windows EC2 SDP Campaign 3" />
              </label>
              <label>
                <span>Short name</span>
                <input value={campaignDraft.shortName} onChange={(event) => updateCampaignDraft("shortName", event.target.value)} placeholder="Windows EC2 SDP Campaign 3" />
              </label>
              <label>
                <span>Start date</span>
                <input type="date" value={campaignDraft.startDate} onChange={(event) => updateCampaignDraft("startDate", event.target.value)} />
              </label>
              <label>
                <span>Budget</span>
                <input value={campaignDraft.budget} onChange={(event) => updateCampaignDraft("budget", event.target.value)} placeholder="$10,000" />
              </label>
              <label className="wide-field">
                <span>Objective</span>
                <textarea value={campaignDraft.objective} onChange={(event) => updateCampaignDraft("objective", event.target.value)} placeholder="What outcome should this campaign create?" />
              </label>
              <label>
                <span>Personas</span>
                <input value={campaignDraft.personas} onChange={(event) => updateCampaignDraft("personas", event.target.value)} placeholder="CTO, CFO, IT Manager" />
              </label>
              <label>
                <span>Target contacts</span>
                <input type="number" value={campaignDraft.plannedContacts} onChange={(event) => updateCampaignDraft("plannedContacts", event.target.value)} />
              </label>
              <label>
                <span>Meetings target</span>
                <input type="number" value={campaignDraft.meetings} onChange={(event) => updateCampaignDraft("meetings", event.target.value)} />
              </label>
              <label>
                <span>Pipeline target</span>
                <input type="number" value={campaignDraft.pipeline} onChange={(event) => updateCampaignDraft("pipeline", event.target.value)} />
              </label>
            </div>
            <div className="field-picker brief-channel-picker">
              {["email", "whatsapp", "call", "linkedin", "webinar", "landing", "task"].map((type) => (
                <label key={type}>
                  <input type="checkbox" checked={(campaignDraft.channelTypes || []).includes(type)} onChange={(event) => toggleDraftChannel(type, event.target.checked)} />
                  <span>{channelMeta[type]?.label || type}</span>
                </label>
              ))}
            </div>
            <div className="editor-actions">
              <button className="secondary-button" onClick={() => setShowBriefModal(false)}>Cancel</button>
              <button className="primary-button" onClick={submitCampaignDraft} disabled={!campaignDraft.name.trim()}>
                <Wand2 size={15} />
                Create draft campaign
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Integrations({ authHeaders, campaignApiUrl, integrationSettings, setIntegrationSettings }) {
  const [googleSecretJson, setGoogleSecretJson] = useState("");
  const [googleSecretStatus, setGoogleSecretStatus] = useState("");
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);
  const [hubspotToken, setHubspotToken] = useState("");
  const [hubspotStatus, setHubspotStatus] = useState("");
  const [showHubspotHelp, setShowHubspotHelp] = useState(false);
  const [justcallApiKey, setJustcallApiKey] = useState("");
  const [justcallApiSecret, setJustcallApiSecret] = useState("");
  const [justcallStatus, setJustcallStatus] = useState("");
  const [showJustcallHelp, setShowJustcallHelp] = useState(false);
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [whatsappStatus, setWhatsappStatus] = useState("");
  const [showWhatsappHelp, setShowWhatsappHelp] = useState(false);
  const googleSheets = integrationSettings.find((setting) => setting.settingKey === "googleSheets") || initialIntegrationSettings[0];
  const hubspotDefault = initialIntegrationSettings.find((setting) => setting.settingKey === "hubspot");
  const hubspot = integrationSettings.find((setting) => setting.settingKey === "hubspot") || hubspotDefault;
  const justcallDefault = initialIntegrationSettings.find((setting) => setting.settingKey === "justcall");
  const justcall = integrationSettings.find((setting) => setting.settingKey === "justcall") || justcallDefault;
  const whatsappDefault = initialIntegrationSettings.find((setting) => setting.settingKey === "whatsapp");
  const whatsapp = integrationSettings.find((setting) => setting.settingKey === "whatsapp") || whatsappDefault;
  const integrations = [
    ["Markdown", "Current source of campaign structure, content, calendars, scripts", "Active locally"],
    ["HubSpot", "Contacts, lists, tasks, lifecycle stages, notes, deals, campaign attribution", hubspot.secretName ? "Configured" : "Needs setup"],
    ["JustCall", "Embedded calling, call logs, recordings, AI call intelligence, sales follow-up tasks", justcall.secretName ? "Configured" : "Needs setup"],
    ["Amazon SNS / SES", "Email send orchestration, delivery events, bounces, complaints, engagement ingestion", "AWS phase"],
    ["WhatsApp Business", "Template approval, sender profiles per campaign, replies, opt-outs, handoff", whatsapp.secretName ? "Configured" : "Needs setup"],
    ["LinkedIn", "Post generation, approvals, publishing queue, engagement reporting", "OAuth phase"]
  ];

  function updateGoogleSheetsSetting(field, value) {
    setIntegrationSettings((current) => {
      const existing = current.some((setting) => setting.settingKey === "googleSheets") ? current : [...current, initialIntegrationSettings[0]];
      return existing.map((setting) =>
        setting.settingKey === "googleSheets"
          ? {
              ...setting,
              [field]: value,
              updatedAt: nowIso()
            }
          : setting
      );
    });
  }

  function updateHubspotSetting(field, value) {
    setIntegrationSettings((current) => {
      const existing = current.some((setting) => setting.settingKey === "hubspot") ? current : [...current, hubspotDefault];
      return existing.map((setting) =>
        setting.settingKey === "hubspot"
          ? {
              ...setting,
              [field]: value,
              updatedAt: nowIso()
            }
          : setting
      );
    });
  }

  function updateJustcallSetting(field, value) {
    setIntegrationSettings((current) => {
      const existing = current.some((setting) => setting.settingKey === "justcall") ? current : [...current, justcallDefault];
      return existing.map((setting) =>
        setting.settingKey === "justcall"
          ? {
              ...setting,
              [field]: value,
              updatedAt: nowIso()
            }
          : setting
      );
    });
  }

  function updateWhatsappSetting(field, value) {
    setIntegrationSettings((current) => {
      const existing = current.some((setting) => setting.settingKey === "whatsapp") ? current : [...current, whatsappDefault];
      return existing.map((setting) =>
        setting.settingKey === "whatsapp"
          ? {
              ...setting,
              [field]: value,
              updatedAt: nowIso()
            }
          : setting
      );
    });
  }

  function updateHubspotProperties(value) {
    updateHubspotSetting(
      "selectedProperties",
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  async function saveGoogleSheetsSecret() {
    setGoogleSecretStatus("Creating or updating AWS secret...");
    try {
      const parsed = JSON.parse(googleSecretJson || "{}");
      const secretName = googleSheets.secretName || "cloudwrxs-campaign-google-sheets-reader";
      const response = await fetch(`${campaignApiUrl}/google-sheets/secret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          secretName,
          serviceAccountJson: JSON.stringify(parsed)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Secret save failed: ${response.status}`);
      updateGoogleSheetsSetting("secretName", result.secretName);
      updateGoogleSheetsSetting("serviceAccountEmail", result.serviceAccountEmail);
      setGoogleSecretJson("");
      setGoogleSecretStatus(`Secret saved. Share Sheets with ${result.serviceAccountEmail}.`);
    } catch (error) {
      setGoogleSecretStatus(error.message);
    }
  }

  async function saveJustcallSecret() {
    setJustcallStatus("Creating or updating JustCall API secret...");
    try {
      const secretName = justcall.secretName || "cloudwrxs-campaign-justcall";
      const response = await fetch(`${campaignApiUrl}/justcall/secret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          secretName,
          apiKey: justcallApiKey,
          apiSecret: justcallApiSecret,
          accountLabel: justcall.accountLabel,
          dialerMode: justcall.dialerMode,
          hourlyLimit: Number(justcall.hourlyLimit || 1800),
          burstLimit: Number(justcall.burstLimit || 30),
          webhookMode: justcall.webhookMode,
          userMappingMode: justcall.userMappingMode
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `JustCall secret save failed: ${response.status}`);
      updateJustcallSetting("secretName", result.secretName);
      updateJustcallSetting("accountLabel", result.accountLabel || justcall.accountLabel || "");
      updateJustcallSetting("dialerMode", result.dialerMode || justcall.dialerMode || "url_popup");
      updateJustcallSetting("hourlyLimit", result.hourlyLimit || justcall.hourlyLimit || 1800);
      updateJustcallSetting("burstLimit", result.burstLimit || justcall.burstLimit || 30);
      updateJustcallSetting("webhookMode", result.webhookMode || justcall.webhookMode || "planned");
      updateJustcallSetting("userMappingMode", result.userMappingMode || justcall.userMappingMode || "email");
      updateJustcallSetting("lastTestedAt", "");
      updateJustcallSetting("lastTestStatus", "saved");
      setJustcallApiKey("");
      setJustcallApiSecret("");
      setJustcallStatus("JustCall credentials saved in AWS Secrets Manager.");
    } catch (error) {
      setJustcallStatus(error.message);
    }
  }

  async function saveWhatsappSecret() {
    setWhatsappStatus("Creating or updating WhatsApp API secret...");
    try {
      const secretName = whatsapp.secretName || "cloudwrxs-campaign-whatsapp";
      const response = await fetch(`${campaignApiUrl}/whatsapp/secret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          accessToken: whatsappAccessToken,
          accountLabel: whatsapp.accountLabel,
          apiVersion: whatsapp.apiVersion || "v23.0",
          secretName
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `WhatsApp secret save failed: ${response.status}`);
      updateWhatsappSetting("secretName", result.secretName);
      updateWhatsappSetting("accountLabel", result.accountLabel || whatsapp.accountLabel || "Cloudwrxs WhatsApp Business");
      updateWhatsappSetting("apiVersion", result.apiVersion || whatsapp.apiVersion || "v23.0");
      updateWhatsappSetting("lastTestedAt", "");
      updateWhatsappSetting("lastTestStatus", "saved");
      setWhatsappAccessToken("");
      setWhatsappStatus("WhatsApp access token saved in AWS Secrets Manager.");
    } catch (error) {
      setWhatsappStatus(error.message);
    }
  }

  async function testWhatsappConnection() {
    setWhatsappStatus("Testing WhatsApp access token...");
    try {
      const response = await fetch(`${campaignApiUrl}/whatsapp/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          apiVersion: whatsapp.apiVersion || "v23.0",
          secretName: whatsapp.secretName
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `WhatsApp test failed: ${response.status}`);
      updateWhatsappSetting("lastTestedAt", result.testedAt || nowIso());
      updateWhatsappSetting("lastTestStatus", "ok");
      updateWhatsappSetting("accountLabel", result.accountLabel || whatsapp.accountLabel || "Cloudwrxs WhatsApp Business");
      setWhatsappStatus(`Connection OK. ${result.tokenType || "Token"} token accepted.`);
    } catch (error) {
      updateWhatsappSetting("lastTestStatus", "failed");
      setWhatsappStatus(error.message);
    }
  }

  async function testJustcallConnection() {
    setJustcallStatus("Testing JustCall connection with one rate-limited users lookup...");
    try {
      const response = await fetch(`${campaignApiUrl}/justcall/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          secretName: justcall.secretName
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `JustCall test failed: ${response.status}`);
      updateJustcallSetting("lastTestedAt", result.testedAt || nowIso());
      updateJustcallSetting("lastTestStatus", "ok");
      updateJustcallSetting("accountLabel", result.accountLabel || justcall.accountLabel || "Cloudwrxs JustCall");
      setJustcallStatus(`Connection OK. ${result.userCountText || "User lookup succeeded"}.`);
    } catch (error) {
      updateJustcallSetting("lastTestStatus", "failed");
      setJustcallStatus(error.message);
    }
  }

  async function saveHubspotSecret() {
    setHubspotStatus("Creating or updating HubSpot token secret...");
    try {
      const secretName = hubspot.secretName || "cloudwrxs-campaign-hubspot-private-app";
      const response = await fetch(`${campaignApiUrl}/hubspot/secret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          secretName,
          accessToken: hubspotToken,
          portalName: hubspot.portalName,
          syncMode: hubspot.syncMode,
          selectedProperties: hubspot.selectedProperties
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HubSpot secret save failed: ${response.status}`);
      updateHubspotSetting("secretName", result.secretName);
      updateHubspotSetting("portalId", result.portalId || hubspot.portalId || "");
      updateHubspotSetting("portalName", result.portalName || hubspot.portalName || "");
      updateHubspotSetting("lastTestedAt", result.testedAt || nowIso());
      updateHubspotSetting("lastTestStatus", result.ok ? "ok" : "saved");
      if (Array.isArray(result.availableProperties)) updateHubspotSetting("availableProperties", result.availableProperties);
      setHubspotToken("");
      setHubspotStatus(result.portalId ? `HubSpot connected to portal ${result.portalId}.` : "HubSpot token saved.");
    } catch (error) {
      setHubspotStatus(error.message);
    }
  }

  async function testHubspotConnection() {
    setHubspotStatus("Testing HubSpot connection...");
    try {
      const response = await fetch(`${campaignApiUrl}/hubspot/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          secretName: hubspot.secretName,
          selectedProperties: hubspot.selectedProperties
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HubSpot test failed: ${response.status}`);
      updateHubspotSetting("portalId", result.portalId || "");
      updateHubspotSetting("portalName", result.portalName || hubspot.portalName || "");
      updateHubspotSetting("lastTestedAt", result.testedAt || nowIso());
      updateHubspotSetting("lastTestStatus", "ok");
      if (Array.isArray(result.availableProperties)) updateHubspotSetting("availableProperties", result.availableProperties);
      setHubspotStatus(`Connection OK. ${result.availableProperties?.length || 0} contact properties discovered.`);
    } catch (error) {
      updateHubspotSetting("lastTestStatus", "failed");
      setHubspotStatus(error.message);
    }
  }

  return (
    <div className="integrations-layout">
      <div className="integration-grid">
        {integrations.map(([name, description, status]) => (
          <article className="panel integration-card" key={name}>
            <PlugZap size={18} />
            <h2>{name}</h2>
            <p>{description}</p>
            <span>{status}</span>
          </article>
        ))}
      </div>
      <section className="panel wide-panel integration-config-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">AWS Secrets Manager</p>
            <h2>Google Sheets service account</h2>
          </div>
          <span className="source-pill google_sheets">{googleSheets.secretName ? "Configured" : "Needs setup"}</span>
        </div>
        <div className="integration-config-grid">
          <label>
            <span>AWS Secrets Manager secret name</span>
            <input
              value={googleSheets.secretName || ""}
              onChange={(event) => updateGoogleSheetsSetting("secretName", event.target.value)}
              placeholder="cloudwrxs-campaign-google-sheets-reader"
            />
          </label>
          <label>
            <span>Service account email</span>
            <input
              value={googleSheets.serviceAccountEmail || ""}
              onChange={(event) => updateGoogleSheetsSetting("serviceAccountEmail", event.target.value)}
              placeholder="campaign-sheets-reader@project.iam.gserviceaccount.com"
            />
          </label>
        </div>
        <div className="secret-json-panel">
          <div className="panel-head">
            <h3>Create or update AWS secret</h3>
            <button className="secondary-button compact" onClick={() => setShowGoogleHelp((current) => !current)}>
              Help
            </button>
          </div>
          {showGoogleHelp && (
            <div className="help-panel">
              <strong>Google service account setup</strong>
              <span>1. In Google Cloud, create or choose the project for this campaign app.</span>
              <span>2. Enable the Google Sheets API for that project.</span>
              <span>3. Create a service account. It does not need Workspace admin rights or domain-wide delegation.</span>
              <span>4. Create a JSON key for the service account and paste the full JSON below.</span>
              <span>5. Share each Google Sheet with the service account email as Viewer.</span>
              <span>6. Keep the AWS secret name starting with cloudwrxs-campaign- so the app role can access it.</span>
            </div>
          )}
          <label>
            <span>Paste Google service account JSON key</span>
            <textarea
              value={googleSecretJson}
              onChange={(event) => setGoogleSecretJson(event.target.value)}
              placeholder='{"type":"service_account","client_email":"...","private_key":"..."}'
            />
          </label>
          <button className="primary-button" onClick={saveGoogleSheetsSecret} disabled={!campaignApiUrl || !googleSecretJson.trim()}>
            <Save size={15} />
            Create / update AWS secret
          </button>
          {googleSecretStatus && <p className="save-status">{googleSecretStatus}</p>}
        </div>
        <p>
          Store the Google service account JSON in the AWS secret above, then share each private Google Sheet with the service account email as Viewer.
          The app will read rows through Lambda without changing Cloudwrxs sharing rules.
        </p>
      </section>
      <section className="panel wide-panel integration-config-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">HubSpot connection</p>
            <h2>Service Key and sync setup</h2>
          </div>
          <span className={`source-pill hubspot ${hubspot.lastTestStatus === "ok" ? "configured" : ""}`}>{hubspot.lastTestStatus === "ok" ? "Connected" : hubspot.secretName ? "Token saved" : "Needs setup"}</span>
        </div>
        <div className="integration-config-grid">
          <label>
            <span>AWS Secrets Manager secret name</span>
            <input
              value={hubspot.secretName || ""}
              onChange={(event) => updateHubspotSetting("secretName", event.target.value)}
              placeholder="cloudwrxs-campaign-hubspot-private-app"
            />
          </label>
          <label>
            <span>Portal / account label</span>
            <input
              value={hubspot.portalName || ""}
              onChange={(event) => updateHubspotSetting("portalName", event.target.value)}
              placeholder="Cloudwrxs HubSpot"
            />
          </label>
          <label>
            <span>HubSpot portal ID</span>
            <input value={hubspot.portalId || ""} onChange={(event) => updateHubspotSetting("portalId", event.target.value)} placeholder="Auto-filled after test" />
          </label>
          <label>
            <span>Sync mode</span>
            <select value={hubspot.syncMode || "lists_and_contacts"} onChange={(event) => updateHubspotSetting("syncMode", event.target.value)}>
              <option value="lists_and_contacts">Lists and contacts</option>
              <option value="lists_only">Lists only</option>
              <option value="contacts_only">Contacts only</option>
            </select>
          </label>
          <label className="wide-field">
            <span>Contact properties to make available for filtering</span>
            <textarea
              value={(hubspot.selectedProperties || []).join(", ")}
              onChange={(event) => updateHubspotProperties(event.target.value)}
              placeholder="email, firstname, lastname, phone, company, jobtitle, country, lifecyclestage"
            />
          </label>
        </div>
        <div className="secret-json-panel">
          <div className="panel-head">
            <h3>Create or update HubSpot Service Key secret</h3>
            <button className="secondary-button compact" onClick={() => setShowHubspotHelp((current) => !current)}>
              Help
            </button>
          </div>
          {showHubspotHelp && (
            <div className="help-panel">
              <strong>HubSpot Service Key setup</strong>
              <span>1. In HubSpot, go to Development, then Keys, then Service keys. In some portals this is under Settings, Integrations, Service Keys.</span>
              <span>2. Create a Service Key for CloudCamp. This is HubSpot's recommended path for single-account REST API access instead of legacy private apps.</span>
              <span>3. Grant scopes for CRM contacts, companies, properties, associations, and lists/segments. Add write scopes for tasks, notes, and HubSpot segment export.</span>
              <span>4. Copy the Service Key once and paste it below. The key is stored in AWS Secrets Manager, not in browser storage.</span>
              <span>5. Use Test connection to confirm the portal and discover available contact properties.</span>
              <span>6. Keep the AWS secret name starting with cloudwrxs-campaign- so the app role can access it.</span>
            </div>
          )}
          <label>
            <span>Paste HubSpot Service Key</span>
            <input
              type="password"
              value={hubspotToken}
              onChange={(event) => setHubspotToken(event.target.value)}
              placeholder="HubSpot Service Key"
            />
          </label>
          <div className="editor-actions">
            <button className="primary-button" onClick={saveHubspotSecret} disabled={!campaignApiUrl || !hubspotToken.trim()}>
              <Save size={15} />
              Create / update Service Key secret
            </button>
            <button className="secondary-button" onClick={testHubspotConnection} disabled={!campaignApiUrl || !hubspot.secretName}>
              <PlugZap size={15} />
              Test connection
            </button>
          </div>
          {hubspotStatus && <p className="save-status">{hubspotStatus}</p>}
        </div>
        <div className="hubspot-property-summary">
          <strong>{hubspot.availableProperties?.length || 0} contact properties discovered</strong>
          <span>{hubspot.lastTestedAt ? `Last tested ${new Date(hubspot.lastTestedAt).toLocaleString()}` : "Test the connection to cache HubSpot fields for the Audience builder."}</span>
        </div>
      </section>
      <section className="panel wide-panel integration-config-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">JustCall connection</p>
            <h2>Calling, recordings, and call intelligence</h2>
          </div>
          <span className={`source-pill justcall ${justcall.lastTestStatus === "ok" ? "configured" : ""}`}>{justcall.lastTestStatus === "ok" ? "Connected" : justcall.secretName ? "Credentials saved" : "Needs setup"}</span>
        </div>
        <div className="integration-config-grid">
          <label>
            <span>AWS Secrets Manager secret name</span>
            <input
              value={justcall.secretName || ""}
              onChange={(event) => updateJustcallSetting("secretName", event.target.value)}
              placeholder="cloudwrxs-campaign-justcall"
            />
          </label>
          <label>
            <span>Account label</span>
            <input
              value={justcall.accountLabel || ""}
              onChange={(event) => updateJustcallSetting("accountLabel", event.target.value)}
              placeholder="Cloudwrxs JustCall"
            />
          </label>
          <label>
            <span>Dialer mode</span>
            <select value={justcall.dialerMode || "desktop_app"} onChange={(event) => updateJustcallSetting("dialerMode", event.target.value)}>
              <option value="desktop_app">Desktop app protocol</option>
              <option value="url_popup">Dialer URL popup first</option>
              <option value="embedded_cti">Embedded CTI SDK target</option>
            </select>
          </label>
          <label>
            <span>User mapping</span>
            <select value={justcall.userMappingMode || "email"} onChange={(event) => updateJustcallSetting("userMappingMode", event.target.value)}>
              <option value="email">Cloudwrxs email to JustCall email</option>
              <option value="manual">Manual user mapping</option>
            </select>
          </label>
          <label>
            <span>Hourly API limit</span>
            <input
              type="number"
              min="1"
              value={justcall.hourlyLimit || 1800}
              onChange={(event) => updateJustcallSetting("hourlyLimit", Number(event.target.value || 1800))}
            />
          </label>
          <label>
            <span>Burst API limit per minute</span>
            <input
              type="number"
              min="1"
              value={justcall.burstLimit || 30}
              onChange={(event) => updateJustcallSetting("burstLimit", Number(event.target.value || 30))}
            />
          </label>
          <label className="wide-field">
            <span>Webhook endpoint for the next build</span>
            <input value={campaignApiUrl ? `${campaignApiUrl}/justcall/webhooks` : "Set VITE_CAMPAIGN_API_URL to show webhook URL"} readOnly />
          </label>
        </div>
        <div className="rate-limit-note">
          <Database size={16} />
          <span>Design guardrail: use webhooks for call updates, cache JustCall results in DynamoDB, and keep API calls under {Number(justcall.burstLimit || 30).toLocaleString()} requests/minute and {Number(justcall.hourlyLimit || 1800).toLocaleString()} requests/hour.</span>
        </div>
        <div className="secret-json-panel">
          <div className="panel-head">
            <h3>Create or update JustCall API secret</h3>
            <button className="secondary-button compact" onClick={() => setShowJustcallHelp((current) => !current)}>
              Help
            </button>
          </div>
          {showJustcallHelp && (
            <div className="help-panel">
              <strong>JustCall API setup</strong>
              <span>1. In JustCall, open your profile menu and choose APIs and Webhooks.</span>
              <span>2. Copy the API Key and API Secret from API Credentials.</span>
              <span>3. Paste them below. They are stored in AWS Secrets Manager and are cleared from the browser after save.</span>
              <span>4. Lead Nurture can launch the installed desktop app through the justcall:// protocol, with a web dialer fallback. The embedded CTI SDK is the target once we confirm SDK access for your plan.</span>
              <span>5. Later, add call completed, call updated, and AI report generated webhooks to the endpoint shown above.</span>
            </div>
          )}
          <div className="integration-config-grid">
            <label>
              <span>Paste JustCall API Key</span>
              <input
                type="password"
                value={justcallApiKey}
                onChange={(event) => setJustcallApiKey(event.target.value)}
                placeholder="JustCall API Key"
              />
            </label>
            <label>
              <span>Paste JustCall API Secret</span>
              <input
                type="password"
                value={justcallApiSecret}
                onChange={(event) => setJustcallApiSecret(event.target.value)}
                placeholder="JustCall API Secret"
              />
            </label>
          </div>
          <div className="editor-actions">
            <button className="primary-button" onClick={saveJustcallSecret} disabled={!campaignApiUrl || !justcallApiKey.trim() || !justcallApiSecret.trim()}>
              <Save size={15} />
              Create / update JustCall secret
            </button>
            <button className="secondary-button" onClick={testJustcallConnection} disabled={!campaignApiUrl || !justcall.secretName}>
              <PlugZap size={15} />
              Test connection
            </button>
          </div>
          {justcallStatus && <p className="save-status">{justcallStatus}</p>}
        </div>
        <div className="hubspot-property-summary">
          <strong>{justcall.dialerMode === "embedded_cti" ? "Embedded CTI SDK target" : justcall.dialerMode === "url_popup" ? "Dialer URL popup first" : "Desktop app protocol first"}</strong>
          <span>{justcall.lastTestedAt ? `Last tested ${new Date(justcall.lastTestedAt).toLocaleString()}` : "Save credentials now; then we can wire Lead Nurture calls, webhooks, recordings, and AI sentiment."}</span>
        </div>
      </section>
      <section className="panel wide-panel integration-config-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">WhatsApp Business Cloud API</p>
            <h2>Meta access token and sender setup</h2>
          </div>
          <span className={`source-pill whatsapp ${whatsapp.lastTestStatus === "ok" ? "configured" : ""}`}>{whatsapp.lastTestStatus === "ok" ? "Connected" : whatsapp.secretName ? "Token saved" : "Needs setup"}</span>
        </div>
        <div className="integration-config-grid">
          <label>
            <span>AWS Secrets Manager secret name</span>
            <input
              value={whatsapp.secretName || ""}
              onChange={(event) => updateWhatsappSetting("secretName", event.target.value)}
              placeholder="cloudwrxs-campaign-whatsapp"
            />
          </label>
          <label>
            <span>Account label</span>
            <input
              value={whatsapp.accountLabel || ""}
              onChange={(event) => updateWhatsappSetting("accountLabel", event.target.value)}
              placeholder="Cloudwrxs WhatsApp Business"
            />
          </label>
          <label>
            <span>Graph API version</span>
            <input
              value={whatsapp.apiVersion || "v23.0"}
              onChange={(event) => updateWhatsappSetting("apiVersion", event.target.value)}
              placeholder="v23.0"
            />
          </label>
          <label>
            <span>Mode</span>
            <input value="Meta Cloud API text send test" readOnly />
          </label>
        </div>
        <div className="secret-json-panel">
          <div className="panel-head">
            <h3>Create or update WhatsApp API secret</h3>
            <button className="secondary-button compact" onClick={() => setShowWhatsappHelp((current) => !current)}>
              Help
            </button>
          </div>
          {showWhatsappHelp && (
            <div className="help-panel">
              <strong>WhatsApp Cloud API setup</strong>
              <span>1. In Meta for Developers, create or open the app connected to the Cloudwrxs WhatsApp Business Account.</span>
              <span>2. Add the WhatsApp product and find the WhatsApp API setup page.</span>
              <span>3. Create a system user access token with whatsapp_business_messaging. Add whatsapp_business_management if we later read templates and phone numbers.</span>
              <span>4. Paste the token below. The token is stored in AWS Secrets Manager, not browser storage.</span>
              <span>5. For each Cloudwrxs sender, add the WhatsApp phone number ID under Settings, Users and calendar links.</span>
              <span>6. For testing, the recipient must be allowed by the Meta test setup or inside an open 24-hour WhatsApp service window. Otherwise we will need approved template sends.</span>
            </div>
          )}
          <label>
            <span>Paste Meta WhatsApp access token</span>
            <input
              type="password"
              value={whatsappAccessToken}
              onChange={(event) => setWhatsappAccessToken(event.target.value)}
              placeholder="EAAB..."
            />
          </label>
          <div className="editor-actions">
            <button className="primary-button" onClick={saveWhatsappSecret} disabled={!campaignApiUrl || !whatsappAccessToken.trim()}>
              <Save size={15} />
              Create / update WhatsApp secret
            </button>
            <button className="secondary-button" onClick={testWhatsappConnection} disabled={!campaignApiUrl || !whatsapp.secretName}>
              <PlugZap size={15} />
              Test connection
            </button>
          </div>
          {whatsappStatus && <p className="save-status">{whatsappStatus}</p>}
        </div>
        <div className="hubspot-property-summary">
          <strong>{whatsapp.secretName ? "Token storage configured" : "Token storage needed"}</strong>
          <span>{whatsapp.lastTestedAt ? `Last tested ${new Date(whatsapp.lastTestedAt).toLocaleString()}` : "After saving the token, set each user's WhatsApp phone number ID in Settings before testing sends."}</span>
        </div>
      </section>
    </div>
  );
}

function Evaluation({ activeCampaignId, authHeaders, benchmarkIdeas, campaignApiUrl, campaigns, setActiveCampaignId }) {
  const [campaignFilter, setCampaignFilter] = useState(activeCampaignId || "all");
  const [results, setResults] = useState([]);
  const [totals, setTotals] = useState({});
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const checks = [
    ["Cadence coverage", "Each campaign includes email, WhatsApp/call follow-up, LinkedIn, and sales actions."],
    ["Persona fit", "Campaign 3 and 4 are strongest on persona specificity; Campaign 1 and 2 should split SDR plays by finance vs technical pains."],
    ["Result loop", "SES/SNS events are now ingested by message ID into send runs and recipient records."],
    ["Risk", "Cold outbound compliance, WhatsApp opt-in handling, LinkedIn API permissions, and SNS/SES deliverability need explicit guardrails."]
  ];
  const selectedRun = results.find((run) => run.sendRunId === selectedRunId) || results[0] || null;

  useEffect(() => {
    setCampaignFilter((current) => current || activeCampaignId || "all");
  }, [activeCampaignId]);

  useEffect(() => {
    fetchResults();
  }, [campaignFilter, authHeaders?.Authorization, campaignApiUrl]);

  async function fetchResults() {
    if (!campaignApiUrl) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (campaignFilter && campaignFilter !== "all") params.set("campaignId", campaignFilter);
      const response = await fetch(`${campaignApiUrl}/send-results?${params.toString()}`, { headers: authHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `Results load failed: ${response.status}`);
      const nextResults = result.results || [];
      setResults(nextResults);
      setTotals(result.totals || {});
      setSelectedRunId((current) => nextResults.some((run) => run.sendRunId === current) ? current : nextResults[0]?.sendRunId || "");
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  function changeCampaignFilter(value) {
    setCampaignFilter(value);
    if (value !== "all") setActiveCampaignId(value);
  }

  function campaignName(campaignId) {
    return campaigns.find((campaign) => campaign.id === campaignId)?.shortName || campaignId;
  }

  function rate(numerator, denominator) {
    if (!denominator) return "0%";
    return `${Math.round((Number(numerator || 0) / Number(denominator || 0)) * 100)}%`;
  }

  return (
    <div className="evaluation-layout">
      <section className="wide-panel panel results-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Email results</p>
            <h2>Send performance and recipient events</h2>
          </div>
          <div className="editor-actions">
            <select value={campaignFilter} onChange={(event) => changeCampaignFilter(event.target.value)}>
              <option value="all">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.shortName}</option>
              ))}
            </select>
            <button className="primary-button compact" onClick={fetchResults} disabled={loading || !campaignApiUrl}>
              <RotateCcw size={15} />
              {loading ? "Syncing" : "Sync results"}
            </button>
          </div>
        </div>
        {error && <p className="send-review-error">{error}</p>}
        <div className="results-metric-grid">
          <Metric title="Sent" value={Number(totals.sent || 0).toLocaleString()} note={`${Number(totals.delivered || 0).toLocaleString()} delivered`} icon={Mail} />
          <Metric title="Open rate" value={rate(totals.uniqueOpens, totals.delivered || totals.sent)} note={`${Number(totals.opens || 0).toLocaleString()} total opens`} icon={Gauge} />
          <Metric title="Click rate" value={rate(totals.uniqueClicks, totals.delivered || totals.sent)} note={`${Number(totals.clicks || 0).toLocaleString()} total clicks`} icon={TrendingUp} />
          <Metric title="Issues" value={Number((totals.bounced || 0) + (totals.complained || 0) + (totals.failed || 0)).toLocaleString()} note={`${Number(totals.bounced || 0).toLocaleString()} bounced · ${Number(totals.failed || 0).toLocaleString()} failed`} icon={PauseCircle} />
        </div>
        <div className="results-grid">
          <div className="results-run-list">
            {results.map((run) => {
              const counts = run.resultCounts || {};
              return (
                <button key={run.sendRunId} className={run.sendRunId === selectedRun?.sendRunId ? "selected" : ""} onClick={() => setSelectedRunId(run.sendRunId)}>
                  <strong>{run.emailLabel || run.subject || run.stepKey}</strong>
                  <span>{campaignName(run.campaignId)} · {run.status}</span>
                  <small>{Number(counts.sent || 0).toLocaleString()} sent · {Number(counts.uniqueOpens || 0).toLocaleString()} opens · {Number(counts.uniqueClicks || 0).toLocaleString()} clicks</small>
                </button>
              );
            })}
            {!results.length && <p className="empty-library-note">{loading ? "Syncing results..." : "No send results found yet."}</p>}
          </div>
          <div className="results-detail">
            {selectedRun ? (
              <>
                <div className="results-detail-head">
                  <div>
                    <span>{campaignName(selectedRun.campaignId)} · {selectedRun.stepKey}</span>
                    <strong>{selectedRun.emailLabel || selectedRun.subject || selectedRun.emailId}</strong>
                  </div>
                  <small>Ingested {formatDateTime(selectedRun.resultsIngestedAt)}</small>
                </div>
                <div className="recipient-results-table">
                  <div className="recipient-results-row heading">
                    <span>Recipient</span>
                    <span>Status</span>
                    <span>Opens</span>
                    <span>Clicks</span>
                    <span>Last event</span>
                  </div>
                  {(selectedRun.recipients || []).map((recipient) => (
                    <div className={`recipient-results-row ${recipient.deliveryStatus}`} key={`${selectedRun.sendRunId}-${recipient.recipientEmail}`}>
                      <span>
                        <strong>{recipient.recipientName || recipient.recipientEmail}</strong>
                        <small>{recipient.recipientEmail}</small>
                      </span>
                      <span>{recipient.deliveryStatus || recipient.status}</span>
                      <span>{recipient.openCount || 0}</span>
                      <span>{recipient.clickCount || 0}</span>
                      <span>{formatDateTime(recipient.lastEventAt || recipient.deliveredAt || recipient.firstOpenedAt)}</span>
                    </div>
                  ))}
                </div>
                <div className="event-timeline">
                  <strong>Recent event timeline</strong>
                  {(selectedRun.timeline || []).slice(0, 12).map((event) => (
                    <article key={`${event.messageId}-${event.eventType}-${event.eventAt}`}>
                      <span>{event.eventType}</span>
                      <strong>{event.recipientEmail}</strong>
                      <small>{formatDateTime(event.eventAt)}</small>
                    </article>
                  ))}
                  {!selectedRun.timeline?.length && <p className="empty-library-note">No SES/SNS events have arrived for this run yet.</p>}
                </div>
              </>
            ) : (
              <p className="empty-library-note">Select a send run to inspect recipient-level outcomes.</p>
            )}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Activity evaluation</p>
            <h2>What the campaign set is doing now</h2>
          </div>
          <Gauge size={20} />
        </div>
        <div className="score-list">
          {checks.map(([title, body]) => (
            <div className="score-item" key={title}>
              <CheckCircle2 size={18} />
              <div>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Competitive feature ideas</p>
            <h2>Worth adding</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="idea-list">
          {benchmarkIdeas.map((idea) => (
            <span key={idea}>{idea}</span>
          ))}
        </div>
      </section>
      <section className="wide-panel panel">
        <h2>Campaign performance snapshot</h2>
        <div className="table">
          <div className="table-row heading">
            <span>Campaign</span>
            <span>Open</span>
            <span>CTR</span>
            <span>Meetings</span>
            <span>Pipeline</span>
          </div>
          {campaigns.map((campaign) => (
            <div className="table-row" key={campaign.id}>
              <span>{campaign.shortName}</span>
              <span>{pct(campaign.metrics.opens)}</span>
              <span>{pct(campaign.metrics.clicks)}</span>
              <span>{campaign.metrics.meetings}</span>
              <span>{currency(campaign.metrics.pipeline)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsPanel({ activeCampaign, senderProfiles, setSenderProfiles }) {
  function addSenderProfile() {
    const nextNumber = senderProfiles.length + 1;
    const ownerId = `user-${Date.now()}`;
    setSenderProfiles((current) => [
      ...current,
      {
        ownerId,
        name: `New User ${nextNumber}`,
        title: "Sales Owner",
        email: "",
        hubspotOwnerId: "",
        whatsappDisplayPhone: "",
        whatsappPhoneNumberId: "",
        calendarLink: "",
        active: true
      }
    ]);
  }

  function updateSenderProfile(ownerId, field, value) {
    setSenderProfiles((current) =>
      current.map((profile) =>
        profile.ownerId === ownerId
          ? {
              ...profile,
              [field]: value
            }
          : profile
      )
    );
  }

  return (
    <div className="settings-layout">
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">AI content design specifications</p>
            <h2>Generation rules</h2>
          </div>
          <Wand2 size={20} />
        </div>
        <div className="setup-form">
          <label>
            <span>Voice and tone</span>
            <textarea defaultValue="Professional, practical, AWS-literate, regionally respectful, concise. Avoid unsupported claims and keep CTAs consultative." />
          </label>
          <label>
            <span>Personalization inputs</span>
            <textarea defaultValue="Persona, industry, current AWS maturity, campaign source, HubSpot lifecycle stage, last touch outcome, preferred language." />
          </label>
          <label>
            <span>Approval policy</span>
            <textarea defaultValue="Draft > marketing review > sales owner review > compliance check for claims > schedule/send." />
          </label>
        </div>
      </section>
      <section className="panel user-config-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Sender configuration</p>
            <h2>Users and calendar links</h2>
          </div>
          <button className="primary-button compact" onClick={addSenderProfile}>
            <Plus size={15} />
            Add user
          </button>
        </div>
        <div className="user-config-list">
          {senderProfiles.map((profile) => (
            <article className="user-config-card" key={profile.ownerId}>
              <div className="user-config-head">
                <div>
                  <strong>{profile.name || "Unnamed user"}</strong>
                  <span>{profile.ownerId}</span>
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.active !== false}
                    onChange={(event) => updateSenderProfile(profile.ownerId, "active", event.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="user-config-form">
                <label>
                  <span>Owner ID</span>
                  <input value={profile.ownerId} readOnly />
                </label>
                <label>
                  <span>Name</span>
                  <input value={profile.name} onChange={(event) => updateSenderProfile(profile.ownerId, "name", event.target.value)} />
                </label>
                <label>
                  <span>Email address</span>
                  <input value={profile.email} onChange={(event) => updateSenderProfile(profile.ownerId, "email", event.target.value)} />
                </label>
                <label>
                  <span>Title</span>
                  <input value={profile.title} onChange={(event) => updateSenderProfile(profile.ownerId, "title", event.target.value)} />
                </label>
                <label>
                  <span>HubSpot owner ID</span>
                  <input value={profile.hubspotOwnerId || ""} onChange={(event) => updateSenderProfile(profile.ownerId, "hubspotOwnerId", event.target.value)} placeholder="Optional numeric owner ID" />
                </label>
                <label>
                  <span>WhatsApp phone number ID</span>
                  <input value={profile.whatsappPhoneNumberId || ""} onChange={(event) => updateSenderProfile(profile.ownerId, "whatsappPhoneNumberId", event.target.value)} placeholder="Meta phone_number_id" />
                </label>
                <label>
                  <span>WhatsApp display number</span>
                  <input value={profile.whatsappDisplayPhone || ""} onChange={(event) => updateSenderProfile(profile.ownerId, "whatsappDisplayPhone", event.target.value)} placeholder="+971..." />
                </label>
                <label className="wide-field">
                  <span>Calendar link</span>
                  <input value={profile.calendarLink} onChange={(event) => updateSenderProfile(profile.ownerId, "calendarLink", event.target.value)} />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <h3>Current campaign context</h3>
        <p>{activeCampaign.objective}</p>
        <p className="build-stamp">Data generated {new Date(generatedAt).toLocaleString()}</p>
      </section>
    </div>
  );
}

function EventDrawer({ event, campaign, scheduleItem, updateEventStatus, onClose }) {
  const meta = channelMeta[event.type] || channelMeta.task;
  const Icon = meta.icon;
  const key = eventKey(campaign, event);
  const eventDate = dateFromPosition(scheduleItem || {});
  const resultPlan = [
    "Planned content, audience segment, and approval state",
    "Send/post/call execution timestamp and owner",
    "Result metrics: delivered, opened, clicked, replied, booked, no-show, opportunity created",
    "HubSpot activity sync, sales task outcome, and next recommended action"
  ];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}>Close</button>
        <span className={`drawer-icon ${meta.className}`}>
          <Icon size={18} />
          {meta.label}
        </span>
        <h2>{event.label || meta.label}: {event.title}</h2>
        <p>{campaign.name}</p>
        <dl>
          <div>
            <dt>Timing</dt>
            <dd>{eventDate ? dateToInputValue(eventDate) : scheduleItem?.month || event.month || "Campaign month"} · {activityTimingLabel(scheduleItem)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{scheduleItem?.status || "queued"}{event.statusDetail ? ` · ${sendRunStatusLabel(event.statusDetail)}` : ""}</dd>
          </div>
          <div>
            <dt>Workflow section</dt>
            <dd>{event.section}</dd>
          </div>
          {event.source === "email_assignment" && (
            <>
              <div>
                <dt>Email automation</dt>
                <dd>{event.sendMode === "calendar_auto" ? "Automatic after review approval" : "Manual calendar send task"}</dd>
              </div>
              <div>
                <dt>Send slot</dt>
                <dd>{event.sendWindow || "09:00-11:00"} · {event.timezone || userTimezone()}</dd>
              </div>
              <div>
                <dt>Audience</dt>
                <dd>{event.audienceListName || event.audienceListId || "No audience recorded"}</dd>
              </div>
              <div>
                <dt>Send run</dt>
                <dd>{event.sendRunId || "No send run created yet"}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>{Number(event.sentCount || 0).toLocaleString()} sent · {Number(event.failedCount || 0).toLocaleString()} failed · {event.remainingQueued === "" ? "unknown" : Number(event.remainingQueued || 0).toLocaleString()} queued</dd>
              </div>
              <div>
                <dt>Email results</dt>
                <dd>{Number(event.deliveredCount || 0).toLocaleString()} delivered · {Number(event.uniqueOpenCount || 0).toLocaleString()} opened · {Number(event.uniqueClickCount || 0).toLocaleString()} clicked</dd>
              </div>
              <div>
                <dt>Total engagement</dt>
                <dd>{Number(event.openCount || 0).toLocaleString()} opens · {Number(event.clickCount || 0).toLocaleString()} clicks · {Number((event.bounceCount || 0) + (event.complaintCount || 0)).toLocaleString()} issues</dd>
              </div>
              {event.lastSentAt && (
                <div>
                  <dt>Last sent</dt>
                  <dd>{formatDateTime(event.lastSentAt)}</dd>
                </div>
              )}
              {event.resultsIngestedAt && (
                <div>
                  <dt>Results synced</dt>
                  <dd>{formatDateTime(event.resultsIngestedAt)}</dd>
                </div>
              )}
            </>
          )}
          <div>
            <dt>Source folder</dt>
            <dd>{campaign.folder}</dd>
          </div>
        </dl>
        <h3>After-action result model</h3>
        <div className="drawer-actions">
          <button onClick={() => updateEventStatus(key, "queued")}>
            <RotateCcw size={15} />
            Queued
          </button>
          <button onClick={() => updateEventStatus(key, "wip")}>
            <PlayCircle size={15} />
            WIP
          </button>
          <button onClick={() => updateEventStatus(key, "paused")}>
            <PauseCircle size={15} />
            Paused
          </button>
          <button onClick={() => updateEventStatus(key, "complete")}>
            <CheckCircle2 size={15} />
            Complete
          </button>
        </div>
        <div className="score-list">
          {resultPlan.map((item) => (
            <div className="score-item" key={item}>
              <CheckCircle2 size={16} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
