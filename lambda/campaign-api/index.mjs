import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BatchGetItemCommand, BatchWriteItemCommand, DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { CreateSecretCommand, GetSecretValueCommand, PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { createHash, createSign } from "node:crypto";

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1" });
const dynamo = new DynamoDBClient({});
const ses = new SESv2Client({ region: process.env.SES_REGION || process.env.AWS_REGION || "us-east-1" });
const secrets = new SecretsManagerClient({});
const environment = process.env.ENVIRONMENT_NAME || "dev";
const sheetMappingModelId = process.env.BEDROCK_SCHEMA_MODEL_ID || "global.anthropic.claude-haiku-4-5-20251001-v1:0";
const sesConfigurationSetName = process.env.SES_CONFIGURATION_SET_NAME || "tracking";
const bulkUpdatableContactFields = new Set(["country", "technology", "persona", "jobTitle", "lifecycleStage", "owner"]);
const audienceFacetFields = new Set(["country", "technology", "persona", "jobTitle", "lifecycleStage", "owner", "company", "emailDomain", "emailStatus"]);
const canonicalEmailContactListId = "canonical-email-contacts";

const tables = {
  campaigns: process.env.CAMPAIGNS_TABLE || `Campaigns-${environment}`,
  activities: process.env.CAMPAIGN_ACTIVITIES_TABLE || `CampaignActivities-${environment}`,
  emails: process.env.CAMPAIGN_EMAILS_TABLE || `CampaignEmails-${environment}`,
  assignments: process.env.CAMPAIGN_EMAIL_ASSIGNMENTS_TABLE || `CampaignEmailAssignments-${environment}`,
  emailSendRuns: process.env.CAMPAIGN_EMAIL_SEND_RUNS_TABLE || `CampaignEmailSendRuns-${environment}`,
  emailSends: process.env.CAMPAIGN_EMAIL_SENDS_TABLE || `CampaignEmailSends-${environment}`,
  senders: process.env.CAMPAIGN_SENDER_PROFILES_TABLE || `CampaignSenderProfiles-${environment}`,
  audienceLists: process.env.CAMPAIGN_AUDIENCE_LISTS_TABLE || `CampaignAudienceLists-${environment}`,
  audienceContacts: process.env.CAMPAIGN_AUDIENCE_CONTACTS_TABLE || `CampaignAudienceContacts-${environment}`,
  audienceMemberships: process.env.CAMPAIGN_AUDIENCE_MEMBERSHIPS_TABLE || `CampaignAudienceMemberships-${environment}`,
  contactEngagement: process.env.CAMPAIGN_CONTACT_ENGAGEMENT_TABLE || `CampaignContactEngagement-${environment}`,
  googleSheetSources: process.env.CAMPAIGN_GOOGLE_SHEET_SOURCES_TABLE || `CampaignGoogleSheetSources-${environment}`,
  integrationSettings: process.env.CAMPAIGN_INTEGRATION_SETTINGS_TABLE || `CampaignIntegrationSettings-${environment}`,
  playbooks: process.env.CAMPAIGN_PLAYBOOKS_TABLE || `CampaignPlaybooks-${environment}`,
  contentAssets: process.env.CAMPAIGN_CONTENT_ASSETS_TABLE || `CampaignContentAssets-${environment}`,
  unsubscribers: process.env.UNSUBSCRIBERS_TABLE || "Unsubscribers",
  emailEvents: process.env.EMAIL_EVENTS_TABLE || "EmailEvents"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,authorization",
  "Access-Control-Allow-Methods": "DELETE,GET,PUT,POST,OPTIONS",
  "Content-Type": "application/json"
};

export async function handler(event) {
  try {
    if (event?.source === "aws.events" || event?.source === "campaign-command.scheduler" || event?.action === "run-send-engine") {
      return await runScheduledSendEngine(event);
    }

    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path || "/";

    if (method === "OPTIONS") return response(204, {});

    if (path === "/google-sheets/read" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await readGoogleSheet(body));
    }

    if (path === "/google-sheets/import-batch" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await importGoogleSheetBatch(body));
    }

    if (path === "/google-sheets/secret" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await saveGoogleSheetsSecret(body));
    }

    if (path === "/hubspot/secret" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await saveHubSpotSecret(body));
    }

    if (path === "/hubspot/test" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await testHubSpotConnection(body));
    }

    if (path === "/hubspot/lists" && method === "GET") {
      return response(200, await searchHubSpotLists(event.queryStringParameters || {}));
    }

    if (path === "/hubspot/import-segment-batch" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await importHubSpotSegmentBatch(body));
    }

    if (path === "/hubspot/import-contacts-batch" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await importHubSpotContactsBatch(body));
    }

    if (path === "/hubspot/export-audience" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await exportAudienceToHubSpotSegment(body));
    }

    if (path === "/audience/sync-suppressions" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await syncAudienceSuppressions(body));
    }

    if (path === "/hubspot/sync-contact" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await syncHubSpotContact(body));
    }

    if (path === "/hubspot/sync-lead-call" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await syncHubSpotLeadCall(body));
    }

    if (path === "/justcall/secret" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await saveJustCallSecret(body));
    }

    if (path === "/justcall/test" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await testJustCallConnection(body));
    }

    if (path === "/audience-contacts" && method === "GET") {
      return response(200, await getAudienceContacts(event.queryStringParameters || {}));
    }

    if (path === "/audience-contacts" && method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      if (body.bulkUpdate) return response(200, await bulkUpdateAudienceContacts(body));
      return response(200, await saveAudienceContact(body));
    }

    if (path === "/audience-contacts" && method === "DELETE") {
      return response(200, await deleteAudienceContacts(event.queryStringParameters || {}));
    }

    if (path === "/send-runs" && method === "GET") {
      return response(200, await listEmailSendRuns(event.queryStringParameters || {}));
    }

    if (path === "/send-results" && method === "GET") {
      return response(200, await getEmailResults(event.queryStringParameters || {}));
    }

    if (path === "/send-runs" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await createEmailSendRun(body));
    }

    if (path === "/send-runs" && method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      return response(200, await updateEmailSendRunStatus(body));
    }

    if (path !== "/state") return response(404, { message: "Not found" });

    if (method === "GET") {
      return response(200, await getState());
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      await saveState(body);
      return response(200, { ok: true, savedAt: new Date().toISOString() });
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return response(500, { message: error.message });
  }
}

async function getState() {
  const [campaignSetups, campaignActivities, templates, assignments, senderProfiles, audienceLists, contactEngagement, googleSheetSources, integrationSettings, playbooks, contentAssets, unsubscribers, emailEvents] = await Promise.all([
    scanAll(tables.campaigns),
    scanAll(tables.activities),
    scanAll(tables.emails),
    scanAll(tables.assignments),
    scanAll(tables.senders),
    scanAll(tables.audienceLists),
    scanAll(tables.contactEngagement),
    scanAll(tables.googleSheetSources),
    scanAll(tables.integrationSettings),
    scanAll(tables.playbooks),
    scanOptional(tables.contentAssets),
    scanLimit(tables.unsubscribers, 750),
    scanLimit(tables.emailEvents, 1500)
  ]);
  const audienceContactCounts = await countAudienceContacts(audienceLists);

  return {
    campaignSetups: campaignSetups.sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || ""))),
    campaignActivities: campaignActivities.sort((a, b) =>
      `${a.campaignId}:${a.plannedDate || ""}:${a.sortOrder || 0}:${a.activityId}`.localeCompare(
        `${b.campaignId}:${b.plannedDate || ""}:${b.sortOrder || 0}:${b.activityId}`
      )
    ),
    templates: templates.sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""))),
    assignments: assignments.sort((a, b) => `${a.campaignId}:${a.stepKey}`.localeCompare(`${b.campaignId}:${b.stepKey}`)),
    senderProfiles: senderProfiles.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    audienceLists: audienceLists.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))),
    audienceContacts: [],
    audienceContactCounts,
    contactEngagement: contactEngagement.sort((a, b) => String(b.eventAt || "").localeCompare(String(a.eventAt || ""))),
    googleSheetSources: googleSheetSources.sort((a, b) => String(b.lastUsedAt || b.updatedAt || "").localeCompare(String(a.lastUsedAt || a.updatedAt || ""))),
    integrationSettings,
    playbooks: playbooks.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))),
    contentAssets: contentAssets.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))),
    unsubscribers,
    emailEvents
  };
}

async function saveState(body) {
  const now = new Date().toISOString();
  const campaignSetups = Array.isArray(body.campaignSetups) ? body.campaignSetups : [];
  const campaignActivities = Array.isArray(body.campaignActivities) ? body.campaignActivities : [];
  const templates = Array.isArray(body.templates) ? body.templates : [];
  const assignments = Array.isArray(body.assignments) ? body.assignments : [];
  const senderProfiles = Array.isArray(body.senderProfiles) ? body.senderProfiles : [];
  const audienceLists = Array.isArray(body.audienceLists) ? body.audienceLists : [];
  const contactEngagement = Array.isArray(body.contactEngagement) ? body.contactEngagement : [];
  const googleSheetSources = Array.isArray(body.googleSheetSources) ? body.googleSheetSources : [];
  const integrationSettings = Array.isArray(body.integrationSettings) ? body.integrationSettings : [];
  const playbooks = Array.isArray(body.playbooks) ? body.playbooks : [];
  const contentAssets = Array.isArray(body.contentAssets) ? body.contentAssets : [];
  const deletedAudienceListIds = Array.isArray(body.deletedAudienceListIds) ? body.deletedAudienceListIds : [];
  const deletedAudienceContacts = Array.isArray(body.deletedAudienceContacts) ? body.deletedAudienceContacts : [];
  const deletedPlaybookIds = Array.isArray(body.deletedPlaybookIds) ? body.deletedPlaybookIds : [];
  const deletedContentAssetIds = Array.isArray(body.deletedContentAssetIds) ? body.deletedContentAssetIds : [];

  for (const campaign of campaignSetups) {
    const campaignId = campaign.campaignId || campaign.id;
    if (!campaignId) continue;
    await put(tables.campaigns, {
      ...campaign,
      campaignId,
      id: campaign.id || campaignId,
      updatedAt: now
    });
  }

  for (const activity of campaignActivities) {
    if (!activity.campaignId || !activity.activityId) continue;
    await put(tables.activities, {
      ...activity,
      updatedAt: now
    });
  }

  for (const template of templates) {
    if (!template.emailId) continue;
    await put(tables.emails, {
      ...template,
      placeholders: placeholderKeys(template.bodyText),
      updatedAt: now
    });
  }

  for (const assignment of assignments) {
    if (!assignment.campaignId || !assignment.stepKey) continue;
    await put(tables.assignments, {
      ...assignment,
      updatedAt: now
    });
  }

  for (const profile of senderProfiles) {
    if (!profile.ownerId) continue;
    await put(tables.senders, {
      ...profile,
      updatedAt: now
    });
  }

  for (const list of audienceLists) {
    if (!list.listId) continue;
    await put(tables.audienceLists, {
      ...list,
      updatedAt: now
    });
  }

  for (const engagement of contactEngagement) {
    if (!engagement.contactId || !engagement.eventId) continue;
    await put(tables.contactEngagement, {
      ...engagement,
      email: String(engagement.email || "").toLowerCase(),
      eventAt: engagement.eventAt || now,
      updatedAt: now
    });
  }

  for (const source of googleSheetSources) {
    if (!source.sheetSourceId) continue;
    await put(tables.googleSheetSources, {
      ...source,
      updatedAt: now
    });
  }

  for (const setting of integrationSettings) {
    if (!setting.settingKey) continue;
    await put(tables.integrationSettings, {
      ...setting,
      updatedAt: now
    });
  }

  for (const playbook of playbooks) {
    if (!playbook.playbookId) continue;
    await put(tables.playbooks, {
      ...playbook,
      updatedAt: now
    });
  }

  for (const asset of contentAssets) {
    if (!asset.assetId) continue;
    await put(tables.contentAssets, {
      ...asset,
      updatedAt: now
    });
  }

  for (const assetId of deletedContentAssetIds) {
    if (!assetId) continue;
    await dynamo.send(new DeleteItemCommand({
      TableName: tables.contentAssets,
      Key: toDynamoItem({ assetId })
    }));
  }

  for (const playbookId of deletedPlaybookIds) {
    if (!playbookId) continue;
    await dynamo.send(new DeleteItemCommand({
      TableName: tables.playbooks,
      Key: toDynamoItem({ playbookId })
    }));
  }

  for (const listId of deletedAudienceListIds) {
    if (!listId) continue;
    await remove(tables.audienceLists, { listId });
  }

  for (const contact of deletedAudienceContacts) {
    if (!contact.listId || !contact.contactId) continue;
    await remove(tables.audienceContacts, { listId: contact.listId, contactId: contact.contactId });
  }
}

async function scanAll(TableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(result.Items || []).map(fromDynamoItem));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function scanOptional(TableName) {
  try {
    return await scanAll(TableName);
  } catch (error) {
    if (error.name === "ResourceNotFoundException") return [];
    throw error;
  }
}

async function scanLimit(TableName, limit = 500) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new ScanCommand({ TableName, ExclusiveStartKey, Limit: Math.min(250, limit - items.length) }));
    items.push(...(result.Items || []).map(fromDynamoItem));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey && items.length < limit);
  return items;
}

async function countAudienceContacts(audienceLists = []) {
  const sourceIds = Array.from(new Set(audienceLists.map((list) => list.sourceListId || list.listId).filter(Boolean)));
  const entries = await Promise.all(sourceIds.map(async (listId) => [listId, await countContactsForList(listId)]));
  return Object.fromEntries(entries);
}

async function countContactsForList(listId) {
  const membershipCount = await countMembershipsForList(listId);
  if (membershipCount > 0) return membershipCount;
  let total = 0;
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceContacts,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey,
      Select: "COUNT"
    }));
    total += result.Count || 0;
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return total;
}

async function countMembershipsForList(listId) {
  let total = 0;
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceMemberships,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey,
      Select: "COUNT"
    }));
    total += result.Count || 0;
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return total;
}

async function getAudienceContacts({ audienceListId, countOnly, excludedContactIds, facet = "", field, filters, frozenContactIds, frozenOnly, listId, limit = "1000", nextToken }) {
  if (audienceListId) {
    const audienceList = await getAudienceList(audienceListId);
    if (!audienceList) throw new Error("Audience list not found");
    listId = audienceList.sourceListId || audienceList.listId;
    filters = filters ?? JSON.stringify(audienceList.frozen ? [] : audienceList.filters || []);
    excludedContactIds = excludedContactIds ?? JSON.stringify(audienceList.excludedContactIds || []);
    frozenOnly = frozenOnly ?? (audienceList.frozen ? "true" : "false");
    frozenContactIds = frozenContactIds ?? JSON.stringify(audienceList.frozenContactIds || []);
  }
  if (!listId) throw new Error("listId is required");
  if (facet === "persona") return audiencePersonaFacet({ listId: audienceListId || listId });
  if (facet === "field") return audienceFieldFacet({ field, listId });
  if (String(countOnly) === "true") {
    return countFilteredAudienceContacts({ excludedContactIds, filters, frozenContactIds, frozenOnly, listId });
  }
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 1000));
  const parsedFilters = parseJsonParam(filters, []);
  const excluded = new Set(parseJsonParam(excludedContactIds, []));
  const frozen = new Set(parseJsonParam(frozenContactIds, []));
  const hasFilters = parsedFilters.length || excluded.size || String(frozenOnly) === "true";
  const needsCompliance = parsedFilters.some((filter) => filter.field === "emailStatus");
  const compliance = hasFilters && needsCompliance ? await loadComplianceIndex() : {};
  const context = hasFilters ? await buildAudienceFilterContext(parsedFilters, compliance) : {};
  const contacts = [];
  let scanned = 0;
  let ExclusiveStartKey = decodePageToken(nextToken);
  const usesMemberships = await listHasMemberships(listId);
  if (usesMemberships) {
    do {
      const result = await dynamo.send(new QueryCommand({
        TableName: tables.audienceMemberships,
        KeyConditionExpression: "listId = :listId",
        ExpressionAttributeValues: {
          ":listId": { S: listId }
        },
        ExclusiveStartKey,
        Limit: hasFilters ? Math.min(1000, Math.max(safeLimit, 250)) : safeLimit
      }));
      const hydrated = await hydrateMembershipContacts((result.Items || []).map(fromDynamoItem));
      for (const contact of hydrated) {
        scanned += 1;
        if (hasFilters) {
          if (excluded.has(contact.contactId)) continue;
          if (String(frozenOnly) === "true" && !frozen.has(contact.contactId)) continue;
          if (!contactMatchesAudienceFilters(contact, parsedFilters, compliance, context)) continue;
        }
        contacts.push(contact);
        if (contacts.length >= safeLimit) break;
      }
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (hasFilters && contacts.length < safeLimit && ExclusiveStartKey);
    return {
      contacts: contacts.sort((a, b) => `${a.lastName || ""}:${a.firstName || ""}:${a.email || ""}`.localeCompare(`${b.lastName || ""}:${b.firstName || ""}:${b.email || ""}`)),
      count: contacts.length,
      listId,
      nextToken: encodePageToken(ExclusiveStartKey),
      scanned
    };
  }
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceContacts,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey,
      Limit: hasFilters ? Math.min(1000, Math.max(safeLimit, 250)) : safeLimit
    }));
    for (const item of result.Items || []) {
      const contact = fromDynamoItem(item);
      scanned += 1;
      if (hasFilters) {
        if (excluded.has(contact.contactId)) continue;
        if (String(frozenOnly) === "true" && !frozen.has(contact.contactId)) continue;
        if (!contactMatchesAudienceFilters(contact, parsedFilters, compliance, context)) continue;
      }
      contacts.push(contact);
      if (contacts.length >= safeLimit) break;
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (hasFilters && contacts.length < safeLimit && ExclusiveStartKey);
  return {
    contacts: contacts.sort((a, b) => `${a.lastName || ""}:${a.firstName || ""}:${a.email || ""}`.localeCompare(`${b.lastName || ""}:${b.firstName || ""}:${b.email || ""}`)),
    count: contacts.length,
    listId,
    nextToken: encodePageToken(ExclusiveStartKey),
    scanned
  };
}

async function audiencePersonaFacet({ listId }) {
  const audienceList = await getAudienceList(listId);
  if (!audienceList) throw new Error("Audience list not found");
  const compliance = await loadComplianceIndex();
  const contacts = await resolveContactsForAudienceList(audienceList, compliance);
  const counts = {};
  let none = 0;
  contacts.forEach((contact) => {
    const persona = String(contact.persona || "").trim();
    if (!persona) {
      none += 1;
      return;
    }
    counts[persona] = (counts[persona] || 0) + 1;
  });
  return {
    facet: "persona",
    listId,
    none,
    options: Object.entries(counts)
      .map(([value, count]) => ({ count, value }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    total: contacts.length
  };
}

async function audienceFieldFacet({ field, listId }) {
  if (!audienceFacetFields.has(field)) throw new Error("Unsupported audience facet field");
  const compliance = field === "emailStatus" ? await loadComplianceIndex() : {};
  const contacts = await loadAudienceContactsForList(listId);
  const counts = {};
  contacts.forEach((contact) => {
    const raw = audienceFilterActualValue(contact, field, compliance);
    String(raw || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => {
        counts[value] = (counts[value] || 0) + 1;
      });
  });
  return {
    facet: "field",
    field,
    listId,
    options: Object.entries(counts)
      .map(([value, count]) => ({ count, value }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    total: contacts.length
  };
}

async function countFilteredAudienceContacts({ excludedContactIds, filters, frozenContactIds, frozenOnly, listId }) {
  const parsedFilters = parseJsonParam(filters, []);
  const excluded = new Set(parseJsonParam(excludedContactIds, []));
  const frozen = new Set(parseJsonParam(frozenContactIds, []));
  const needsCompliance = parsedFilters.some((filter) => filter.field === "emailStatus");
  const compliance = needsCompliance ? await loadComplianceIndex() : {};
  const context = await buildAudienceFilterContext(parsedFilters, compliance);
  if (await listHasMemberships(listId)) {
    const contacts = await loadAudienceContactsForList(listId);
    let total = 0;
    contacts.forEach((contact) => {
      if (excluded.has(contact.contactId)) return;
      if (String(frozenOnly) === "true" && !frozen.has(contact.contactId)) return;
      if (contactMatchesAudienceFilters(contact, parsedFilters, compliance, context)) total += 1;
    });
    return { count: total, checked: contacts.length, listId };
  }
  let total = 0;
  let checked = 0;
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceContacts,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey
    }));
    for (const item of result.Items || []) {
      const contact = fromDynamoItem(item);
      checked += 1;
      if (excluded.has(contact.contactId)) continue;
      if (String(frozenOnly) === "true" && !frozen.has(contact.contactId)) continue;
      if (contactMatchesAudienceFilters(contact, parsedFilters, compliance, context)) total += 1;
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return { count: total, checked, listId };
}

async function listHasMemberships(listId) {
  const result = await dynamo.send(new QueryCommand({
    TableName: tables.audienceMemberships,
    KeyConditionExpression: "listId = :listId",
    ExpressionAttributeValues: {
      ":listId": { S: listId }
    },
    Limit: 1,
    Select: "COUNT"
  }));
  return (result.Count || 0) > 0;
}

async function hydrateMembershipContacts(memberships = []) {
  if (!memberships.length) return [];
  const contacts = await batchGetContacts(memberships.map((membership) => ({
    listId: membership.contactListId || membership.listId,
    contactId: membership.contactId
  })));
  const byKey = new Map(contacts.map((contact) => [`${contact.listId}:${contact.contactId}`, contact]));
  return memberships
    .map((membership) => {
      const contactListId = membership.contactListId || membership.listId;
      const contact = byKey.get(`${contactListId}:${membership.contactId}`);
      if (!contact) return null;
      return {
        ...contact,
        contactListId,
        listId: membership.listId,
        membershipSource: membership.sourceName || membership.sourceHubSpotListId || "",
        membershipUpdatedAt: membership.updatedAt || ""
      };
    })
    .filter(Boolean);
}

async function batchGetContacts(keys = []) {
  const contacts = [];
  for (let index = 0; index < keys.length; index += 100) {
    let RequestItems = {
      [tables.audienceContacts]: {
        Keys: keys.slice(index, index + 100).map((key) => toDynamoItem(key))
      }
    };
    do {
      const result = await dynamo.send(new BatchGetItemCommand({ RequestItems }));
      contacts.push(...((result.Responses?.[tables.audienceContacts] || []).map(fromDynamoItem)));
      RequestItems = result.UnprocessedKeys || {};
      if (Object.keys(RequestItems).length) await sleep(200);
    } while (Object.keys(RequestItems).length);
  }
  return contacts;
}

async function buildAudienceFilterContext(filters = [], compliance = {}, seen = new Set()) {
  const audienceListIds = filters
    .filter((filter) => filter.field === "audienceExclusion")
    .flatMap(filterValueList);
  if (!audienceListIds.length) return { audienceExclusionEmails: new Set() };

  const audienceLists = await scanAll(tables.audienceLists);
  const audienceExclusionEmails = new Set();
  for (const listId of audienceListIds) {
    const list = audienceLists.find((item) => item.listId === listId);
    if (!list || seen.has(list.listId)) continue;
    const emails = await audienceListEmails(list, audienceLists, compliance, new Set(seen));
    emails.forEach((email) => audienceExclusionEmails.add(email));
  }
  return { audienceExclusionEmails };
}

async function audienceListEmails(list, audienceLists, compliance, seen) {
  const emails = new Set();
  if (!list?.sourceListId || seen.has(list.listId)) return emails;
  seen.add(list.listId);

  const contacts = await loadAudienceContactsForList(list.sourceListId);
  const excluded = new Set(list.excludedContactIds || []);
  const frozen = new Set(list.frozenContactIds || []);
  const filters = list.filters || [];
  const needsCompliance = filters.some((filter) => filter.field === "emailStatus");
  const listCompliance = needsCompliance && !Object.keys(compliance || {}).length ? await loadComplianceIndex() : compliance;
  const context = await buildAudienceFilterContext(filters, listCompliance, seen);

  contacts.forEach((contact) => {
    if (excluded.has(contact.contactId)) return;
    if (list.frozen && !frozen.has(contact.contactId)) return;
    if (!list.frozen && !contactMatchesAudienceFilters(contact, filters, listCompliance, context)) return;
    const email = emailKey(contact.email);
    if (email) emails.add(email);
  });
  return emails;
}

async function loadAudienceContactsForList(listId) {
  if (await listHasMemberships(listId)) {
    const memberships = [];
    let ExclusiveStartKey;
    do {
      const result = await dynamo.send(new QueryCommand({
        TableName: tables.audienceMemberships,
        KeyConditionExpression: "listId = :listId",
        ExpressionAttributeValues: {
          ":listId": { S: listId }
        },
        ExclusiveStartKey
      }));
      memberships.push(...(result.Items || []).map(fromDynamoItem));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return hydrateMembershipContacts(memberships);
  }
  const contacts = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceContacts,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey
    }));
    contacts.push(...(result.Items || []).map(fromDynamoItem));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return contacts;
}

async function loadComplianceIndex() {
  const [unsubscribers, emailEvents] = await Promise.all([
    scanAll(tables.unsubscribers),
    scanAll(tables.emailEvents)
  ]);
  const index = {};
  unsubscribers.forEach((item) => {
    const email = emailKey(item.email || item.recipient);
    if (email) index[email] = { suppressed: true, reason: "unsubscribed" };
  });
  emailEvents.forEach((item) => {
    const email = emailKey(item.recipient || item.email);
    if (!email) return;
    const eventType = String(item.eventType || "").toLowerCase();
    if (eventType === "bounce" && index[email]?.reason !== "unsubscribed") index[email] = { suppressed: true, reason: "bounced" };
    if (eventType === "complaint") index[email] = { suppressed: true, reason: "complaint" };
  });
  return index;
}

function contactMatchesAudienceFilters(contact, filters = [], compliance = {}, context = {}) {
  const activeFilters = filters.filter((filter) => filter.operator === "in" ? filterValueList(filter).length : filter.value);
  return activeFilters.every((filter) => {
    if (filter.field === "audienceExclusion") return !context.audienceExclusionEmails?.has(emailKey(contact.email));
    const actual = String(audienceFilterActualValue(contact, filter.field, compliance)).toLowerCase();
    const expected = String(filter.value || "").toLowerCase();
    if (filter.operator === "contains") return actual.includes(expected);
    if (filter.operator === "in") return filterValueList(filter).map((item) => item.toLowerCase()).includes(actual);
    if (filter.operator === "not_equals") return actual !== expected;
    return actual === expected;
  });
}

function filterValueList(filter = {}) {
  const values = Array.isArray(filter.values)
    ? filter.values
    : String(filter.value || "").split(",");
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
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

function parseJsonParam(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function emailKey(email = "") {
  return String(email).trim().toLowerCase();
}

async function saveAudienceContact(contact) {
  if (!contact?.listId || !contact?.contactId) throw new Error("listId and contactId are required");
  const viewListId = contact.listId;
  const contactListId = contact.contactListId || contact.listId;
  const item = {
    ...contact,
    listId: contactListId,
    email: String(contact.email || "").toLowerCase(),
    updatedAt: new Date().toISOString()
  };
  await put(tables.audienceContacts, item);
  return {
    ok: true,
    contact: contactListId === viewListId
      ? item
      : { ...item, listId: viewListId, contactListId }
  };
}

async function bulkUpdateAudienceContacts({
  contactIds,
  contacts,
  excludedContactIds,
  field,
  filters,
  frozenContactIds,
  frozenOnly,
  limit = "750",
  listId,
  nextToken,
  scope = "page",
  value = ""
}) {
  if (!listId) throw new Error("listId is required");
  if (!bulkUpdatableContactFields.has(field)) throw new Error("Field is not bulk updatable");

  const safeLimit = Math.max(1, Math.min(Number(limit) || 750, 1000));
  const now = new Date().toISOString();
  let contactsToUpdate = [];
  let checked = 0;
  let encodedNextToken = "";

  if (scope === "page") {
    const requestedIds = new Set(Array.isArray(contactIds) ? contactIds : []);
    contactsToUpdate = (Array.isArray(contacts) ? contacts : [])
      .filter((contact) => contact?.listId === listId && contact?.contactId && (!requestedIds.size || requestedIds.has(contact.contactId)));
    checked = requestedIds.size || contactsToUpdate.length;
  } else {
    const parsedFilters = parseJsonParam(filters, []);
    const excluded = new Set(parseJsonParam(excludedContactIds, []));
    const frozen = new Set(parseJsonParam(frozenContactIds, []));
    const needsCompliance = parsedFilters.some((filter) => filter.field === "emailStatus");
    const compliance = needsCompliance ? await loadComplianceIndex() : {};
    const context = await buildAudienceFilterContext(parsedFilters, compliance);
    if (await listHasMemberships(listId)) {
      const allContacts = await loadAudienceContactsForList(listId);
      for (const contact of allContacts) {
        checked += 1;
        if (excluded.has(contact.contactId)) continue;
        if (String(frozenOnly) === "true" && !frozen.has(contact.contactId)) continue;
        if (!contactMatchesAudienceFilters(contact, parsedFilters, compliance, context)) continue;
        contactsToUpdate.push(contact);
      }
      encodedNextToken = "";
    } else {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceContacts,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey: decodePageToken(nextToken),
      Limit: safeLimit
    }));

    for (const item of result.Items || []) {
      const contact = fromDynamoItem(item);
      checked += 1;
      if (excluded.has(contact.contactId)) continue;
      if (String(frozenOnly) === "true" && !frozen.has(contact.contactId)) continue;
      if (!contactMatchesAudienceFilters(contact, parsedFilters, compliance, context)) continue;
      contactsToUpdate.push(contact);
    }
    encodedNextToken = encodePageToken(result.LastEvaluatedKey);
    }
  }

  await putAudienceContactsWithField(contactsToUpdate, field, String(value || ""), now);

  return {
    ok: true,
    checked,
    done: scope === "page" || !encodedNextToken,
    field,
    listId,
    nextToken: encodedNextToken,
    scope,
    updated: contactsToUpdate.length
  };
}

async function putAudienceContactsWithField(contacts, field, value, updatedAt) {
  for (let index = 0; index < contacts.length; index += 25) {
    const chunk = contacts.slice(index, index + 25);
    await Promise.all(chunk.map((contact) => put(tables.audienceContacts, {
      ...contact,
      listId: contact.contactListId || contact.listId,
      [field]: value,
      updatedAt
    })));
  }
}

async function deleteAudienceContacts({ listId, limit = "1000" }) {
  if (!listId) throw new Error("listId is required");
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000));
  const membershipResult = await dynamo.send(new QueryCommand({
    TableName: tables.audienceMemberships,
    KeyConditionExpression: "listId = :listId",
    ExpressionAttributeValues: {
      ":listId": { S: listId }
    },
    ProjectionExpression: "listId, contactId",
    Limit: safeLimit
  }));
  const membershipKeys = (membershipResult.Items || []).map((item) => ({
    listId: fromAttributeValue(item.listId),
    contactId: fromAttributeValue(item.contactId)
  }));
  if (membershipKeys.length) {
    await batchDelete(tables.audienceMemberships, membershipKeys);
    return {
      deleted: membershipKeys.length,
      done: !membershipResult.LastEvaluatedKey,
      listId,
      relationship: "memberships"
    };
  }
  const result = await dynamo.send(new QueryCommand({
    TableName: tables.audienceContacts,
    KeyConditionExpression: "listId = :listId",
    ExpressionAttributeValues: {
      ":listId": { S: listId }
    },
    ProjectionExpression: "listId, contactId",
    Limit: safeLimit
  }));
  const keys = (result.Items || []).map((item) => ({
    listId: fromAttributeValue(item.listId),
    contactId: fromAttributeValue(item.contactId)
  }));
  await batchDelete(tables.audienceContacts, keys);
  return {
    deleted: keys.length,
    done: !result.LastEvaluatedKey,
    listId
  };
}

async function listEmailSendRuns({ campaignId = "", limit = "50", sendRunId = "" }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  if (sendRunId) {
    const runResult = await dynamo.send(new GetItemCommand({
      TableName: tables.emailSendRuns,
      Key: toDynamoItem({ sendRunId })
    }));
    if (!runResult.Item) return { sendRun: null, sendRecords: [] };
    const recordsResult = await dynamo.send(new QueryCommand({
      TableName: tables.emailSends,
      KeyConditionExpression: "sendRunId = :sendRunId",
      ExpressionAttributeValues: {
        ":sendRunId": { S: sendRunId }
      },
      Limit: Math.max(1, Math.min(Number(limit) || 1000, 5000))
    }));
    return {
      sendRun: fromDynamoItem(runResult.Item),
      sendRecords: (recordsResult.Items || []).map(fromDynamoItem),
      nextToken: encodePageToken(recordsResult.LastEvaluatedKey)
    };
  }
  if (campaignId) {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.emailSendRuns,
      IndexName: "CampaignCreatedAtIndex",
      KeyConditionExpression: "campaignId = :campaignId",
      ExpressionAttributeValues: {
        ":campaignId": { S: campaignId }
      },
      Limit: safeLimit,
      ScanIndexForward: false
    }));
    return { sendRuns: (result.Items || []).map(fromDynamoItem) };
  }
  const sendRuns = (await scanLimit(tables.emailSendRuns, safeLimit))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { sendRuns };
}

async function getEmailResults({ campaignId = "", limit = "25", sendRunId = "" }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 50));
  let runs = [];
  if (sendRunId) {
    const result = await dynamo.send(new GetItemCommand({
      TableName: tables.emailSendRuns,
      Key: toDynamoItem({ sendRunId })
    }));
    runs = result.Item ? [fromDynamoItem(result.Item)] : [];
  } else if (campaignId) {
    const result = await listEmailSendRuns({ campaignId, limit: String(safeLimit) });
    runs = result.sendRuns || [];
  } else {
    const result = await listEmailSendRuns({ limit: String(safeLimit) });
    runs = result.sendRuns || [];
  }

  const results = [];
  for (const run of runs) {
    results.push(await ingestEmailResultsForSendRun(run));
  }
  return {
    ok: true,
    ingestedAt: new Date().toISOString(),
    results,
    totals: summarizeResultSet(results)
  };
}

async function ingestEmailResultsForSendRun(run = {}) {
  const records = await loadSendRecords(run.sendRunId);
  const messageIds = Array.from(new Set(records.map((record) => record.messageId).filter(Boolean)));
  const eventsByMessageId = await loadEmailEventsForMessageIds(messageIds);
  const now = new Date().toISOString();
  const recipientResults = [];
  const timeline = [];
  const counts = {
    total: records.length,
    queued: 0,
    skipped: 0,
    sent: 0,
    failed: 0,
    sending: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    pendingDelivery: 0
  };

  for (const record of records) {
    const events = (eventsByMessageId.get(record.messageId) || []).sort(compareEmailEvents);
    const summary = summarizeEmailEvents(events);
    const deliveryStatus = deliveryStatusForRecord(record, summary);
    if (record.status === "queued") counts.queued += 1;
    if (record.status === "skipped") counts.skipped += 1;
    if (record.status === "failed") counts.failed += 1;
    if (record.status === "sending") counts.sending += 1;
    if (record.status === "sent") counts.sent += 1;
    if (deliveryStatus === "delivered") counts.delivered += 1;
    if (deliveryStatus === "bounced") counts.bounced += 1;
    if (deliveryStatus === "complained") counts.complained += 1;
    if (summary.unsubscribed) counts.unsubscribed += 1;
    counts.opens += summary.openCount;
    counts.clicks += summary.clickCount;
    if (summary.openCount > 0) counts.uniqueOpens += 1;
    if (summary.clickCount > 0) counts.uniqueClicks += 1;
    if (record.status === "sent" && deliveryStatus === "sent") counts.pendingDelivery += 1;

    events.forEach((event) => {
      timeline.push({
        eventAt: eventTimeIso(event),
        eventType: event.eventType || "",
        messageId: event.messageId || "",
        recipientEmail: event.recipient || record.recipientEmail || "",
        url: event.url || event.link || ""
      });
    });

    const nextRecord = {
      ...record,
      clickCount: summary.clickCount,
      deliveredAt: summary.deliveredAt || record.deliveredAt || "",
      deliveryStatus,
      eventSummary: summary.typeCounts,
      firstClickedAt: summary.firstClickedAt || record.firstClickedAt || "",
      firstOpenedAt: summary.firstOpenedAt || record.firstOpenedAt || "",
      lastEventAt: summary.lastEventAt || record.lastEventAt || "",
      lastOpenedAt: summary.lastOpenedAt || record.lastOpenedAt || "",
      openCount: summary.openCount,
      resultsIngestedAt: now,
      updatedAt: now
    };
    if (summary.bouncedAt) nextRecord.bouncedAt = summary.bouncedAt;
    if (summary.complainedAt) nextRecord.complainedAt = summary.complainedAt;
    if (events.length || record.resultsIngestedAt) await put(tables.emailSends, nextRecord);

    recipientResults.push({
      clickCount: summary.clickCount,
      company: record.company || "",
      deliveredAt: nextRecord.deliveredAt,
      deliveryStatus,
      eventCount: events.length,
      firstClickedAt: nextRecord.firstClickedAt,
      firstOpenedAt: nextRecord.firstOpenedAt,
      lastEventAt: nextRecord.lastEventAt,
      messageId: record.messageId || "",
      openCount: summary.openCount,
      recipientEmail: record.recipientEmail || "",
      recipientName: record.recipientName || "",
      senderEmail: record.senderEmail || "",
      senderName: record.senderName || "",
      status: record.status || ""
    });
  }

  const nextRun = {
    ...run,
    resultCounts: counts,
    resultsIngestedAt: now,
    updatedAt: now
  };
  await put(tables.emailSendRuns, nextRun);
  await updateCalendarActivityForSendRun(nextRun);
  return {
    campaignId: run.campaignId || "",
    emailId: run.emailId || "",
    emailLabel: run.emailLabel || "",
    resultCounts: counts,
    resultsIngestedAt: now,
    sendDate: run.sendDate || "",
    sendRunId: run.sendRunId || "",
    sendWindow: run.sendWindow || "",
    status: run.status || "",
    stepKey: run.stepKey || "",
    subject: run.subject || "",
    timeline: timeline.sort((a, b) => String(b.eventAt || "").localeCompare(String(a.eventAt || ""))).slice(0, 200),
    recipients: recipientResults.sort((a, b) => String(b.lastEventAt || b.deliveredAt || "").localeCompare(String(a.lastEventAt || a.deliveredAt || ""))).slice(0, 500)
  };
}

async function loadEmailEventsForMessageIds(messageIds = []) {
  const eventsByMessageId = new Map();
  for (let index = 0; index < messageIds.length; index += 20) {
    const chunk = messageIds.slice(index, index + 20);
    const chunkResults = await Promise.all(chunk.map(async (messageId) => {
      const events = [];
      let ExclusiveStartKey;
      do {
        const result = await dynamo.send(new QueryCommand({
          TableName: tables.emailEvents,
          IndexName: "MessageIndex",
          KeyConditionExpression: "messageId = :messageId",
          ExpressionAttributeValues: {
            ":messageId": { S: messageId }
          },
          ExclusiveStartKey
        }));
        events.push(...(result.Items || []).map(fromDynamoItem));
        ExclusiveStartKey = result.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return [messageId, events];
    }));
    chunkResults.forEach(([messageId, events]) => eventsByMessageId.set(messageId, events));
  }
  return eventsByMessageId;
}

function summarizeEmailEvents(events = []) {
  const typeCounts = {};
  let deliveredAt = "";
  let firstClickedAt = "";
  let firstOpenedAt = "";
  let lastEventAt = "";
  let lastOpenedAt = "";
  let bouncedAt = "";
  let complainedAt = "";
  events.forEach((event) => {
    const type = normalizeEmailEventType(event.eventType);
    const eventAt = eventTimeIso(event);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    if (eventAt && (!lastEventAt || eventAt > lastEventAt)) lastEventAt = eventAt;
    if (type === "delivery" && (!deliveredAt || eventAt < deliveredAt)) deliveredAt = eventAt;
    if (type === "open") {
      if (!firstOpenedAt || eventAt < firstOpenedAt) firstOpenedAt = eventAt;
      if (!lastOpenedAt || eventAt > lastOpenedAt) lastOpenedAt = eventAt;
    }
    if (type === "click" && (!firstClickedAt || eventAt < firstClickedAt)) firstClickedAt = eventAt;
    if (type === "bounce" && (!bouncedAt || eventAt < bouncedAt)) bouncedAt = eventAt;
    if (type === "complaint" && (!complainedAt || eventAt < complainedAt)) complainedAt = eventAt;
  });
  return {
    bouncedAt,
    clickCount: typeCounts.click || 0,
    complainedAt,
    deliveredAt,
    firstClickedAt,
    firstOpenedAt,
    lastEventAt,
    lastOpenedAt,
    openCount: typeCounts.open || 0,
    typeCounts,
    unsubscribed: Boolean(typeCounts.unsubscribe)
  };
}

function deliveryStatusForRecord(record = {}, summary = {}) {
  if (summary.typeCounts?.complaint) return "complained";
  if (summary.typeCounts?.bounce) return "bounced";
  if (summary.typeCounts?.delivery) return "delivered";
  if (record.status === "failed") return "failed";
  if (record.status === "skipped") return "skipped";
  if (record.status === "queued") return "queued";
  return record.status === "sent" ? "sent" : record.status || "unknown";
}

function compareEmailEvents(a = {}, b = {}) {
  return String(eventTimeIso(a)).localeCompare(String(eventTimeIso(b)));
}

function eventTimeIso(event = {}) {
  if (event.eventTime) {
    const timestamp = Number(event.eventTime);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  if (event.eventTimeISO) return event.eventTimeISO;
  if (event.eventAt) return event.eventAt;
  return "";
}

function normalizeEmailEventType(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "send") return "send";
  if (normalized === "delivery" || normalized === "delivered") return "delivery";
  if (normalized === "open") return "open";
  if (normalized === "click") return "click";
  if (normalized === "bounce" || normalized === "bounced") return "bounce";
  if (normalized === "complaint" || normalized === "complained") return "complaint";
  if (normalized === "unsubscribe" || normalized === "unsubscribed") return "unsubscribe";
  return normalized || "unknown";
}

function summarizeResultSet(results = []) {
  return results.reduce((totals, result) => {
    const counts = result.resultCounts || {};
    Object.entries(counts).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Number(value || 0);
    });
    return totals;
  }, {});
}

function chunkArray(items = [], size = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function createEmailSendRun({
  audienceListId,
  campaignId,
  mode = "manual_review",
  personaFilter = "",
  recordLimit = 1000,
  sampleLimit = 5,
  sendDate = "",
  sendWindow = "",
  stepKey,
  timezone = ""
}) {
  if (!campaignId || !stepKey || !audienceListId) throw new Error("campaignId, stepKey, and audienceListId are required");
  const [assignment, audienceList, senderProfiles, compliance] = await Promise.all([
    getAssignment(campaignId, stepKey),
    getAudienceList(audienceListId),
    scanAll(tables.senders),
    loadComplianceIndex()
  ]);
  if (!assignment) throw new Error("Email assignment not found");
  if (!assignment.enabled) throw new Error("Email assignment is disabled");
  if (!audienceList) throw new Error("Audience list not found");
  const template = await getEmailTemplate(assignment.emailId);
  if (!template) throw new Error("Email template not found");

  const resolvedPersonaFilter = normalizePersonaFilter(personaFilter || assignment.personaFilter || assignment.persona || "ALL");
  const allContacts = await resolveContactsForAudienceList(audienceList, compliance);
  const contacts = allContacts.filter((contact) => contactMatchesPersonaFilter(contact, resolvedPersonaFilter));
  const now = new Date().toISOString();
  const sendRunId = `sendrun-${Date.now()}-${createHash("sha1").update(`${campaignId}:${stepKey}:${audienceListId}:${now}`).digest("hex").slice(0, 8)}`;
  const ownerIds = assignmentOwnerIds(assignment, senderProfiles);
  const activeSenderProfiles = senderProfiles.filter((profile) => profile.active !== false);
  const senderById = new Map(activeSenderProfiles.map((profile) => [profile.ownerId, profile]));
  const safeRecordLimit = Math.max(0, Math.min(Number(recordLimit) || 1000, 5000));
  const safeSampleLimit = Math.max(1, Math.min(Number(sampleLimit) || 5, 20));
  const seenEmails = new Set();
  const recordsToStore = [];
  const previewRecipients = [];
  const counts = {
    totalContacts: allContacts.length,
    personaMatched: contacts.length,
    eligible: 0,
    skipped: 0,
    duplicateEmail: 0,
    missingEmail: 0,
    missingSender: 0,
    suppressed: 0,
    byOwner: {},
    bySkipReason: {}
  };

  contacts.forEach((contact) => {
    const email = emailKey(contact.email);
    let status = "queued";
    let skipReason = "";
    if (!email || !email.includes("@")) {
      status = "skipped";
      skipReason = "missing_email";
      counts.missingEmail += 1;
    } else if (seenEmails.has(email)) {
      status = "skipped";
      skipReason = "duplicate_email";
      counts.duplicateEmail += 1;
    } else if (compliance[email]?.suppressed) {
      status = "skipped";
      skipReason = compliance[email].reason || "suppressed";
      counts.suppressed += 1;
    }
    if (email) seenEmails.add(email);

    const ownerId = status === "queued" ? ownerIdForContact(contact, assignment, ownerIds) : "";
    const sender = ownerId ? senderById.get(ownerId) : null;
    if (status === "queued" && !sender) {
      status = "skipped";
      skipReason = "missing_sender";
      counts.missingSender += 1;
    }

    if (status === "queued") {
      counts.eligible += 1;
      counts.byOwner[ownerId] = (counts.byOwner[ownerId] || 0) + 1;
    } else {
      counts.skipped += 1;
      counts.bySkipReason[skipReason] = (counts.bySkipReason[skipReason] || 0) + 1;
    }

    const rendered = status === "queued"
      ? renderEmailForContact({ assignment, campaignId, contact, ownerId, sender, stepKey, template })
      : {};
    const record = {
      sendRunId,
      recipientEmail: email || `missing-${contact.contactId || recordsToStore.length}`,
      audienceListId,
      campaignId,
      contactId: contact.contactId || "",
      contactListId: contact.contactListId || contact.listId || "",
      company: contact.company || "",
      createdAt: now,
      emailId: template.emailId,
      ownerId,
      recipientName: contactNameForHubSpot(contact),
      persona: contact.persona || "",
      personaFilter: resolvedPersonaFilter,
      senderEmail: sender?.email || "",
      senderName: sender?.name || "",
      skipReason,
      status,
      stepKey,
      subject: rendered.subject || "",
      websiteLink: rendered.websiteLink || ""
    };
    if (recordsToStore.length < safeRecordLimit) recordsToStore.push(record);
    if (status === "queued" && previewRecipients.length < safeSampleLimit) {
      previewRecipients.push({
        contactId: contact.contactId || "",
        company: contact.company || "",
        email,
        name: contactNameForHubSpot(contact),
        ownerId,
        senderName: sender?.name || "",
        subject: rendered.subject,
        bodyText: rendered.bodyText,
        websiteLink: rendered.websiteLink,
        calendarLink: rendered.calendarLink
      });
    }
  });

  const sendRun = {
    sendRunId,
    audienceListId,
    audienceListName: audienceList.name || audienceListId,
    campaignId,
    createdAt: now,
    counts,
    emailId: template.emailId,
    emailLabel: template.label || "",
    mode: normalizeSendMode(mode || assignment.sendMode),
    personaFilter: resolvedPersonaFilter,
    personaLabel: personaFilterLabel(resolvedPersonaFilter),
    previewRecipients,
    recordLimitApplied: contacts.length > safeRecordLimit,
    recordsSaved: recordsToStore.length,
    sampleCount: previewRecipients.length,
    sendDate: sendDate || assignment.sendDate || "",
    sendWindow: sendWindow || assignment.sendWindow || "09:00-11:00",
    status: "review_required",
    stepKey,
    subject: template.subject || "",
    timezone: timezone || assignment.timezone || "UTC",
    updatedAt: now
  };
  await put(tables.emailSendRuns, sendRun);
  await batchPut(tables.emailSends, recordsToStore);
  await updateCalendarActivityForSendRun(sendRun);
  return {
    ok: true,
    sendRun,
    previewRecipients,
    recordsSaved: recordsToStore.length
  };
}

function normalizePersonaFilter(value = "ALL") {
  const normalized = String(value || "").trim();
  if (!normalized || ["ALL", "All personas", "All"].includes(normalized)) return "ALL";
  if (["<NONE>", "__NONE__", "NONE", "None", "No persona"].includes(normalized)) return "__NONE__";
  return normalized;
}

function personaFilterLabel(value = "ALL") {
  const filter = normalizePersonaFilter(value);
  if (filter === "ALL") return "ALL";
  if (filter === "__NONE__") return "<NONE>";
  return filter;
}

function contactMatchesPersonaFilter(contact = {}, value = "ALL") {
  const filter = normalizePersonaFilter(value);
  if (filter === "ALL") return true;
  const persona = String(contact.persona || "").trim();
  if (filter === "__NONE__") return !persona;
  return persona.toLowerCase() === filter.toLowerCase();
}

async function updateEmailSendRunStatus({ action, reason = "", sendDate = "", sendWindow = "", sendRunId, timezone = "" }) {
  if (!sendRunId) throw new Error("sendRunId is required");
  const normalizedAction = String(action || "").toLowerCase();
  if (!["approve", "reject", "reschedule", "send"].includes(normalizedAction)) throw new Error("action must be approve, reject, reschedule, or send");
  const result = await dynamo.send(new GetItemCommand({
    TableName: tables.emailSendRuns,
    Key: toDynamoItem({ sendRunId })
  }));
  if (!result.Item) throw new Error("Send review run not found");
  const current = fromDynamoItem(result.Item);
  if (["sent", "sending"].includes(current.status)) throw new Error("This run is already in a sending state and cannot be changed");
  const now = new Date().toISOString();
  if (normalizedAction === "send") return sendApprovedEmailRun(current);
  if (normalizedAction === "reschedule") {
    if (["rejected", "sent", "sending"].includes(current.status)) throw new Error("This run cannot be rescheduled");
    const nextSendDate = sendDate || current.sendDate || "";
    const nextSendWindow = sendWindow || current.sendWindow || "09:00-11:00";
    const nextTimezone = timezone || current.timezone || "UTC";
    const next = {
      ...current,
      rescheduledAt: now,
      sendDate: nextSendDate,
      sendWindow: nextSendWindow,
      timezone: nextTimezone,
      updatedAt: now
    };
    await put(tables.emailSendRuns, next);
    await updateAssignmentScheduleFromSendRun(next);
    await updateCalendarActivityForSendRun(next);
    return { ok: true, sendRun: next };
  }
  if (normalizedAction === "approve" && current.status !== "review_required") throw new Error("This review run has already been approved or rejected");
  if (normalizedAction === "reject" && (!["review_required", "approved"].includes(current.status) || Number(current.sentCount || 0) > 0)) {
    throw new Error("This review run can no longer be rejected");
  }
  const status = normalizedAction === "approve" ? "approved" : "rejected";
  const next = {
    ...current,
    approvedAt: normalizedAction === "approve" ? now : current.approvedAt || "",
    rejectedAt: normalizedAction === "reject" ? now : current.rejectedAt || "",
    rejectionReason: normalizedAction === "reject" ? String(reason || "").trim() : "",
    reviewAction: normalizedAction,
    reviewedAt: now,
    status,
    updatedAt: now
  };
  await put(tables.emailSendRuns, next);
  await updateCalendarActivityForSendRun(next);
  return { ok: true, sendRun: next };
}

async function runScheduledSendEngine(event = {}) {
  const now = event.now ? new Date(event.now) : new Date();
  const suppressionSync = await syncAudienceSuppressions({
    removeFromHubSpotSegments: event.removeSuppressedFromHubSpotSegments !== false
  });
  const [assignments, sendRuns] = await Promise.all([
    scanAll(tables.assignments),
    scanAll(tables.emailSendRuns)
  ]);
  const existingAutoRunKeys = new Set(
    sendRuns
      .filter((run) => run.mode === "calendar_auto")
      .map((run) => calendarAutoRunKey(run))
      .filter(Boolean)
  );
  const createdReviewRuns = [];
  const skippedAssignments = [];

  for (const assignment of assignments.filter(isCalendarAutoAssignment)) {
    const runKey = calendarAutoRunKey(assignment);
    if (!runKey || existingAutoRunKeys.has(runKey)) continue;
    if (!assignment.audienceListId) {
      skippedAssignments.push({
        campaignId: assignment.campaignId,
        reason: "missing_audience_list",
        stepKey: assignment.stepKey
      });
      continue;
    }
    const result = await createEmailSendRun({
      audienceListId: assignment.audienceListId,
      campaignId: assignment.campaignId,
      mode: "calendar_auto",
      recordLimit: 5000,
      sampleLimit: 5,
      sendDate: assignment.sendDate,
      sendWindow: assignment.sendWindow || "09:00-11:00",
      stepKey: assignment.stepKey,
      timezone: assignment.timezone || "UTC"
    });
    createdReviewRuns.push(result.sendRun);
    existingAutoRunKeys.add(runKey);
  }

  const refreshedRuns = createdReviewRuns.length ? await scanAll(tables.emailSendRuns) : sendRuns;
  const dueRuns = refreshedRuns
    .filter((run) => run.mode === "calendar_auto")
    .filter((run) => isSendableRunStatus(run, now))
    .filter((run) => isRunInsideSendWindow(run, now))
    .sort((a, b) => String(a.sendDate || "").localeCompare(String(b.sendDate || "")) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

  const sentRuns = [];
  const maxRunsPerTick = Math.max(1, Math.min(Number(event.maxRunsPerTick) || 10, 25));
  for (const run of dueRuns.slice(0, maxRunsPerTick)) {
    const result = await sendApprovedEmailRun(run, { source: "scheduled" });
    sentRuns.push({
      failed: result.failed || 0,
      remainingQueued: result.remainingQueued || 0,
      sendRunId: run.sendRunId,
      sent: result.sent || 0,
      status: result.sendRun?.status || run.status
    });
  }
  const resultIngestions = [];
  const runsForIngestion = refreshedRuns
    .filter((run) => ["sent", "partially_sent", "sent_with_failures"].includes(run.status))
    .sort((a, b) => String(b.lastSentAt || b.updatedAt || b.createdAt || "").localeCompare(String(a.lastSentAt || a.updatedAt || a.createdAt || "")))
    .slice(0, 10);
  for (const run of runsForIngestion) {
    const result = await ingestEmailResultsForSendRun(run);
    resultIngestions.push({
      delivered: result.resultCounts?.delivered || 0,
      opens: result.resultCounts?.opens || 0,
      clicks: result.resultCounts?.clicks || 0,
      sendRunId: run.sendRunId
    });
  }

  return {
    ok: true,
    checkedAt: now.toISOString(),
    createdReviewRuns: createdReviewRuns.length,
    dueRuns: dueRuns.length,
    resultIngestions,
    sentRuns,
    skippedAssignments,
    suppressionSync
  };
}

function isCalendarAutoAssignment(assignment = {}) {
  return assignment.enabled !== false && assignment.sendMode === "calendar_auto" && Boolean(assignment.campaignId && assignment.stepKey && assignment.sendDate);
}

function calendarAutoRunKey(item = {}) {
  if (!item.campaignId || !item.stepKey || !item.sendDate) return "";
  return `${item.campaignId}:${item.stepKey}:${item.sendDate}:calendar_auto`;
}

function isRunInsideSendWindow(run = {}, now = new Date()) {
  if (!run.sendDate) return false;
  const timezone = run.timezone || "UTC";
  const local = localTimeParts(now, timezone);
  if (local.date !== run.sendDate) return false;
  const window = parseSendWindow(run.sendWindow || "09:00-11:00");
  if (!window) return true;
  if (window.endMinutes < window.startMinutes) {
    return local.minutes >= window.startMinutes || local.minutes < window.endMinutes;
  }
  return local.minutes >= window.startMinutes && local.minutes < window.endMinutes;
}

function isSendableRunStatus(run = {}, now = new Date()) {
  if (["approved", "partially_sent", "sent_with_failures"].includes(run.status)) return true;
  return run.status === "sending" && isStaleSendingRun(run, now);
}

function isStaleSendingRun(run = {}, now = new Date(), staleMinutes = 15) {
  const startedAt = Date.parse(run.sendingStartedAt || run.updatedAt || "");
  if (!Number.isFinite(startedAt)) return false;
  return now.getTime() - startedAt > staleMinutes * 60 * 1000;
}

function localTimeParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone || "UTC",
    year: "numeric"
  }).formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(valueByType.hour || 0);
  const minute = Number(valueByType.minute || 0);
  return {
    date: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
    minutes: hour * 60 + minute
  };
}

function parseSendWindow(value = "") {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
  return {
    endMinutes: endHour * 60 + endMinute,
    startMinutes: startHour * 60 + startMinute
  };
}

async function sendApprovedEmailRun(run, { source = "manual" } = {}) {
  if (run.mode === "calendar_auto" && source !== "scheduled") {
    throw new Error("Automatic calendar runs are sent by the scheduled send engine after approval and inside the configured send window");
  }
  if (!["approved", "partially_sent", "sent_with_failures"].includes(run.status) && !isStaleSendingRun(run)) {
    throw new Error("Only approved runs can be sent manually");
  }
  let [records, assignment, template, senderProfiles] = await Promise.all([
    loadSendRecords(run.sendRunId),
    getAssignment(run.campaignId, run.stepKey),
    getEmailTemplate(run.emailId),
    scanAll(tables.senders)
  ]);
  if (!assignment) throw new Error("Email assignment not found");
  if (!template) throw new Error("Email template not found");
  const recoveredRecords = await recoverStaleSendingSendRecords(records);
  if (recoveredRecords > 0) records = await loadSendRecords(run.sendRunId);
  const senderById = new Map(senderProfiles.map((profile) => [profile.ownerId, profile]));
  const queuedRecords = records.filter((record) => record.status === "queued").slice(0, 50);
  if (!queuedRecords.length) {
    const next = { ...run, status: run.status === "approved" ? "sent" : run.status, updatedAt: new Date().toISOString() };
    await put(tables.emailSendRuns, next);
    await updateCalendarActivityForSendRun(next);
    return { ok: true, sendRun: next, sent: 0, failed: 0, remainingQueued: 0 };
  }

  const startedAt = new Date().toISOString();
  await put(tables.emailSendRuns, { ...run, status: "sending", sendingStartedAt: startedAt, updatedAt: startedAt });
  let sent = 0;
  let failed = 0;
  let skippedClaims = 0;
  const nextContactOwnerAssignments = { ...(assignment.contactOwnerAssignments || {}) };

  for (const record of queuedRecords) {
    const claimedRecord = await claimQueuedSendRecord(record, startedAt);
    if (!claimedRecord) {
      skippedClaims += 1;
      continue;
    }
    try {
      const sender = senderById.get(claimedRecord.ownerId) || senderProfiles.find((profile) => profile.email === claimedRecord.senderEmail);
      const contact = await loadContactForSendRecord(claimedRecord);
      if (!sender?.email) throw new Error("Missing sender email");
      const rendered = renderEmailForContact({
        assignment,
        campaignId: run.campaignId,
        contact,
        ownerId: claimedRecord.ownerId,
        sender,
        stepKey: run.stepKey,
        template
      });
      const messageId = await sendSesEmail({
        bodyText: rendered.bodyText,
        campaignId: run.campaignId,
        fromEmail: sender.email,
        fromName: sender.name || "",
        recipientEmail: claimedRecord.recipientEmail,
        sendRunId: run.sendRunId,
        stepKey: run.stepKey,
        subject: rendered.subject,
        unsubscribeLink: rendered.unsubscribeLink
      });
      await put(tables.emailSends, {
        ...claimedRecord,
        messageId,
        sentAt: new Date().toISOString(),
        status: "sent",
        updatedAt: new Date().toISOString()
      });
      if (claimedRecord.contactId && claimedRecord.ownerId) nextContactOwnerAssignments[claimedRecord.contactId] = claimedRecord.ownerId;
      if (claimedRecord.recipientEmail && claimedRecord.ownerId) nextContactOwnerAssignments[emailKey(claimedRecord.recipientEmail)] = claimedRecord.ownerId;
      sent += 1;
    } catch (error) {
      await put(tables.emailSends, {
        ...claimedRecord,
        failedAt: new Date().toISOString(),
        failureReason: error.message || "SES send failed",
        status: "failed",
        updatedAt: new Date().toISOString()
      });
      failed += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const refreshedRecords = await loadSendRecords(run.sendRunId);
  const remainingQueued = refreshedRecords.filter((record) => record.status === "queued").length;
  const totalSent = refreshedRecords.filter((record) => record.status === "sent").length;
  const totalFailed = refreshedRecords.filter((record) => record.status === "failed").length;
  const finishedAt = new Date().toISOString();
  const nextStatus = remainingQueued > 0 ? "partially_sent" : totalFailed > 0 ? "sent_with_failures" : "sent";
  if (sent > 0) {
    await put(tables.assignments, {
      ...assignment,
      contactOwnerAssignments: nextContactOwnerAssignments,
      senderLocked: true,
      updatedAt: finishedAt
    });
  }
  const nextRun = {
    ...run,
    claimedSkippedCount: Number(run.claimedSkippedCount || 0) + skippedClaims,
    failedCount: totalFailed,
    lastSentAt: finishedAt,
    remainingQueued,
    sentCount: totalSent,
    status: nextStatus,
    updatedAt: finishedAt
  };
  await put(tables.emailSendRuns, nextRun);
  await updateCalendarActivityForSendRun(nextRun);
  return { ok: true, sendRun: nextRun, sent, failed, remainingQueued, skippedClaims };
}

async function claimQueuedSendRecord(record = {}, claimedAt = new Date().toISOString()) {
  if (!record.sendRunId || !record.recipientEmail) return null;
  try {
    const result = await dynamo.send(new UpdateItemCommand({
      TableName: tables.emailSends,
      Key: toDynamoItem({
        recipientEmail: record.recipientEmail,
        sendRunId: record.sendRunId
      }),
      UpdateExpression: "SET #status = :sending, claimedAt = :claimedAt, updatedAt = :claimedAt",
      ConditionExpression: "#status = :queued",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":claimedAt": { S: claimedAt },
        ":queued": { S: "queued" },
        ":sending": { S: "sending" }
      },
      ReturnValues: "ALL_NEW"
    }));
    return result.Attributes ? fromDynamoItem(result.Attributes) : null;
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return null;
    throw error;
  }
}

async function recoverStaleSendingSendRecords(records = [], now = new Date()) {
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const staleRecords = records.filter((record) => record.status === "sending" && String(record.claimedAt || record.updatedAt || "") < cutoff);
  let recovered = 0;
  for (const record of staleRecords) {
    try {
      await dynamo.send(new UpdateItemCommand({
        TableName: tables.emailSends,
        Key: toDynamoItem({
          recipientEmail: record.recipientEmail,
          sendRunId: record.sendRunId
        }),
        UpdateExpression: "SET #status = :queued, recoveredAt = :recoveredAt, updatedAt = :recoveredAt REMOVE claimedAt",
        ConditionExpression: "#status = :sending",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":queued": { S: "queued" },
          ":recoveredAt": { S: now.toISOString() },
          ":sending": { S: "sending" }
        }
      }));
      recovered += 1;
    } catch (error) {
      if (error.name !== "ConditionalCheckFailedException") throw error;
    }
  }
  return recovered;
}

async function updateCalendarActivityForSendRun(run = {}) {
  if (!run.campaignId || !run.stepKey) return;
  if (!isCalendarLinkedSendRun(run)) return;
  const activityId = `email-assignment-${slugify(run.stepKey)}`;
  const activityStatus = calendarActivityStatusForSendRun(run);
  const result = await dynamo.send(new GetItemCommand({
    TableName: tables.activities,
    Key: toDynamoItem({ campaignId: run.campaignId, activityId })
  }));
  const current = result.Item ? fromDynamoItem(result.Item) : {};
  const isAutomatic = run.mode === "calendar_auto";
  const resultCounts = run.resultCounts || current.resultCounts || {};
  await put(tables.activities, {
    ...current,
    activityId,
    audienceListId: run.audienceListId || current.audienceListId || "",
    audienceListName: run.audienceListName || current.audienceListName || "",
    campaignId: run.campaignId,
    emailAssignmentKey: `${run.campaignId}:${run.stepKey}`,
    emailId: run.emailId || current.emailId || "",
    emailLabel: run.emailLabel || current.emailLabel || "",
    bounceCount: Number(resultCounts.bounced ?? current.bounceCount ?? 0),
    clickCount: Number(resultCounts.clicks ?? current.clickCount ?? 0),
    complaintCount: Number(resultCounts.complained ?? current.complaintCount ?? 0),
    deliveredCount: Number(resultCounts.delivered ?? current.deliveredCount ?? 0),
    failedCount: Number(run.failedCount || current.failedCount || 0),
    label: current.label || run.stepKey?.replace(/^Email\s*/i, "E") || "E",
    lastSentAt: run.lastSentAt || current.lastSentAt || "",
    openCount: Number(resultCounts.opens ?? current.openCount ?? 0),
    plannedDate: run.sendDate || current.plannedDate || "",
    remainingQueued: Number(run.remainingQueued ?? current.remainingQueued ?? 0),
    resultCounts,
    resultsIngestedAt: run.resultsIngestedAt || current.resultsIngestedAt || "",
    reviewedAt: run.reviewedAt || current.reviewedAt || "",
    sendMode: run.mode || current.sendMode || "calendar_manual",
    sendRunId: run.sendRunId || current.sendRunId || "",
    sendWindow: run.sendWindow || current.sendWindow || "09:00-11:00",
    sentCount: Number(run.sentCount || current.sentCount || 0),
    section: current.section || (isAutomatic ? "Automatic email send" : "Manual calendar send task"),
    source: "email_assignment",
    sourceMonth: current.sourceMonth || "",
    sourceWeek: current.sourceWeek || "Email automation",
    status: activityStatus,
    statusDetail: run.status || current.statusDetail || "",
    subject: run.subject || current.subject || "",
    timezone: run.timezone || current.timezone || "UTC",
    title: current.title || run.emailLabel || run.subject || run.stepKey || "Campaign email",
    type: "email",
    uniqueClickCount: Number(resultCounts.uniqueClicks ?? current.uniqueClickCount ?? 0),
    uniqueOpenCount: Number(resultCounts.uniqueOpens ?? current.uniqueOpenCount ?? 0)
  });
}

function isCalendarLinkedSendRun(run = {}) {
  return ["calendar_auto", "calendar_manual"].includes(run.mode);
}

function calendarActivityStatusForSendRun(run = {}) {
  if (run.status === "sent") return "complete";
  if (run.status === "rejected") return "paused";
  if (["approved", "sending", "partially_sent", "sent_with_failures"].includes(run.status)) return "wip";
  return "queued";
}

async function updateAssignmentScheduleFromSendRun(run = {}) {
  if (!run.campaignId || !run.stepKey || !["calendar_auto", "calendar_manual"].includes(run.mode)) return;
  const assignment = await getAssignment(run.campaignId, run.stepKey);
  if (!assignment) return;
  await put(tables.assignments, {
    ...assignment,
    sendDate: run.sendDate || assignment.sendDate || "",
    sendWindow: run.sendWindow || assignment.sendWindow || "09:00-11:00",
    timezone: run.timezone || assignment.timezone || "UTC",
    updatedAt: new Date().toISOString()
  });
}

async function loadSendRecords(sendRunId) {
  const records = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.emailSends,
      KeyConditionExpression: "sendRunId = :sendRunId",
      ExpressionAttributeValues: {
        ":sendRunId": { S: sendRunId }
      },
      ExclusiveStartKey
    }));
    records.push(...(result.Items || []).map(fromDynamoItem));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return records;
}

async function loadContactForSendRecord(record) {
  if (record.contactListId && record.contactId) {
    const result = await dynamo.send(new GetItemCommand({
      TableName: tables.audienceContacts,
      Key: toDynamoItem({ listId: record.contactListId, contactId: record.contactId })
    }));
    if (result.Item) return fromDynamoItem(result.Item);
  }
  const [firstName = "", ...lastName] = String(record.recipientName || "").split(/\s+/);
  return {
    company: record.company || "",
    contactId: record.contactId || "",
    email: record.recipientEmail || "",
    firstName,
    lastName: lastName.join(" ")
  };
}

async function sendSesEmail({ bodyText, campaignId, fromEmail, fromName, recipientEmail, sendRunId, stepKey, subject, unsubscribeLink = "" }) {
  const command = new SendEmailCommand({
    FromEmailAddress: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
    Destination: {
      ToAddresses: [recipientEmail]
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject || "Cloudwrxs"
        },
        Body: {
          Html: {
            Data: buildCampaignEmailHtml(bodyText, unsubscribeLink)
          }
        }
      }
    },
    ConfigurationSetName: sesConfigurationSetName,
    EmailTags: [
      { Name: "campaignId", Value: campaignId || "general" },
      { Name: "sendRunId", Value: sendRunId || "manual" },
      { Name: "stepKey", Value: stepKey || "email" }
    ]
  });
  const result = await ses.send(command);
  return result.MessageId || "";
}

function buildCampaignEmailHtml(bodyText = "", unsubscribeLink = "") {
  const linked = escapeHtml(bodyText).replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
  const unsubscribeFooter = unsubscribeLink
    ? `<hr style="margin:25px 0;" />
      <p style="font-size:12px; color:#888888;">
        If you no longer wish to receive campaign emails,
        <a href="${escapeHtml(unsubscribeLink)}">click here to unsubscribe</a>.
      </p>`
    : "";
  return `
<html>
  <body style="font-family: Arial, sans-serif; font-size:14px; line-height:1.6; color:#333333; margin:0; padding:20px; background-color:#f5f5f5;">
    <div style="max-width:700px; margin:auto; background:#ffffff; padding:30px; border-radius:12px;">
      <p>${linked.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>
      <br/>
      <p>Best Regards,</p>
      <p style="font-size:11px; color:#777777; line-height:1.5; margin-top:30px;">
        NOTICE AND DISCLAIMER!! The content of this email is confidential and intended for the recipient specified in message only.
      </p>
      ${unsubscribeFooter}
    </div>
  </body>
</html>`;
}

async function getAssignment(campaignId, stepKey) {
  const result = await dynamo.send(new GetItemCommand({
    TableName: tables.assignments,
    Key: toDynamoItem({ campaignId, stepKey })
  }));
  return result.Item ? fromDynamoItem(result.Item) : null;
}

async function getEmailTemplate(emailId) {
  if (!emailId) return null;
  const result = await dynamo.send(new GetItemCommand({
    TableName: tables.emails,
    Key: toDynamoItem({ emailId })
  }));
  return result.Item ? fromDynamoItem(result.Item) : null;
}

async function getAudienceList(listId) {
  const result = await dynamo.send(new GetItemCommand({
    TableName: tables.audienceLists,
    Key: toDynamoItem({ listId })
  }));
  return result.Item ? fromDynamoItem(result.Item) : null;
}

async function resolveContactsForAudienceList(audienceList, compliance) {
  const sourceListId = audienceList.sourceListId || audienceList.listId;
  const contacts = await loadAudienceContactsForList(sourceListId);
  const filters = Array.isArray(audienceList.filters) ? audienceList.filters : [];
  const excluded = new Set(audienceList.excludedContactIds || []);
  const frozen = new Set(audienceList.frozenContactIds || []);
  const hasListRules = Boolean(audienceList.sourceListId) || filters.length || excluded.size || audienceList.frozen;
  if (!hasListRules) return contacts;
  const context = await buildAudienceFilterContext(filters, compliance);
  return contacts.filter((contact) => {
    if (excluded.has(contact.contactId)) return false;
    if (audienceList.frozen && !frozen.has(contact.contactId)) return false;
    if (!audienceList.frozen && !contactMatchesAudienceFilters(contact, filters, compliance, context)) return false;
    return true;
  });
}

function normalizeSendMode(mode = "manual_review") {
  return ["manual_review", "calendar_manual", "calendar_auto"].includes(mode) ? mode : "manual_review";
}

function assignmentOwnerIds(assignment = {}, senderProfiles = []) {
  const profileFallback = senderProfiles.find((profile) => profile.active !== false)?.ownerId;
  const ids = Array.isArray(assignment.ownerIds) && assignment.ownerIds.length
    ? assignment.ownerIds
    : [assignment.owner || profileFallback];
  return Array.from(new Set(ids.filter(Boolean)));
}

function ownerIdForContact(contact = {}, assignment = {}, ownerIds = []) {
  const directAssignments = assignment.contactOwnerAssignments || {};
  const direct = directAssignments[contact.contactId] || directAssignments[emailKey(contact.email)];
  if (direct && ownerIds.includes(direct)) return direct;
  if (contact.owner && ownerIds.includes(contact.owner)) return contact.owner;
  if (!ownerIds.length) return "";
  const hash = createHash("sha1").update(emailKey(contact.email) || contact.contactId || JSON.stringify(contact)).digest();
  return ownerIds[hash[0] % ownerIds.length];
}

function renderEmailForContact({ assignment = {}, campaignId, contact = {}, ownerId, sender = {}, stepKey, template = {} }) {
  const websiteLink = trackedWebsiteLink(assignment.placeholderValues?.WEBSITE_LINK || "", { campaignId, contact, ownerId, stepKey, template });
  const calendarLink = sender.calendarLink || "";
  const unsubscribeLink = unsubscribeUrl({ campaignId, contact });
  const values = {
    CALENDAR_LINK: calendarLink,
    COMPANY: contact.company || "",
    EMAIL: contact.email || "",
    FIRST_NAME: contact.firstName || "there",
    LAST_NAME: contact.lastName || "",
    OWNER_EMAIL: sender.email || "",
    OWNER_NAME: sender.name || "",
    OWNER_TITLE: sender.title || "",
    UNSUBSCRIBE_LINK: unsubscribeLink,
    WEBSITE_LINK: websiteLink
  };
  return {
    bodyText: replaceTemplatePlaceholders(template.bodyText || "", values),
    calendarLink,
    subject: replaceTemplatePlaceholders(template.subject || "", values),
    unsubscribeLink,
    websiteLink
  };
}

function replaceTemplatePlaceholders(text = "", values = {}) {
  return String(text).replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_match, key) => values[key] ?? "");
}

function trackedWebsiteLink(baseLink, { campaignId, contact, ownerId, stepKey, template }) {
  const fallback = assignmentUrlFallback(baseLink);
  try {
    const url = new URL(fallback);
    url.searchParams.set("link", url.searchParams.get("link") || "website");
    url.searchParams.set("campaignId", campaignId || "general");
    url.searchParams.set("email", contact.email || "");
    url.searchParams.set("emailId", template.emailId || "");
    url.searchParams.set("stepKey", stepKey || "");
    if (ownerId) url.searchParams.set("ownerId", ownerId);
    return url.toString();
  } catch {
    return fallback;
  }
}

function assignmentUrlFallback(value = "") {
  const trimmed = String(value || "").trim();
  return trimmed || "https://cloudwrxs.com/?link=website";
}

function unsubscribeUrl({ campaignId, contact }) {
  const url = new URL("https://6ivy46nscvu7ksmomj4vj4csp40ldsrl.lambda-url.us-east-1.on.aws/");
  url.searchParams.set("email", contact.email || "");
  url.searchParams.set("campaignId", campaignId || "general");
  url.searchParams.set("link", "unsubscribe");
  return url.toString();
}

async function put(TableName, item) {
  await dynamo.send(new PutItemCommand({ TableName, Item: toDynamoItem(item) }));
}

async function remove(TableName, key) {
  await dynamo.send(new DeleteItemCommand({ TableName, Key: toDynamoItem(key) }));
}

async function saveGoogleSheetsSecret({ secretName, serviceAccountJson }) {
  if (!secretName || !String(secretName).startsWith("cloudwrxs-campaign-")) {
    throw new Error("Secret name must start with cloudwrxs-campaign-");
  }
  const serviceAccount = JSON.parse(serviceAccountJson || "{}");
  if (!serviceAccount.client_email || !serviceAccount.private_key || serviceAccount.type !== "service_account") {
    throw new Error("Paste a valid Google service account JSON key");
  }
  const SecretString = JSON.stringify(serviceAccount);
  try {
    await secrets.send(new CreateSecretCommand({
      Name: secretName,
      SecretString,
      Description: "Cloudwrxs Campaign Command Google Sheets service account"
    }));
  } catch (error) {
    if (error.name !== "ResourceExistsException") throw error;
    await secrets.send(new PutSecretValueCommand({ SecretId: secretName, SecretString }));
  }
  const setting = {
    settingKey: "googleSheets",
    secretName,
    serviceAccountEmail: serviceAccount.client_email,
    mode: "service_account",
    updatedAt: new Date().toISOString()
  };
  await put(tables.integrationSettings, setting);
  return {
    ok: true,
    secretName,
    serviceAccountEmail: serviceAccount.client_email
  };
}

async function saveHubSpotSecret({ accessToken, portalName = "", secretName, selectedProperties = [], syncMode = "lists_and_contacts" }) {
  if (!secretName || !String(secretName).startsWith("cloudwrxs-campaign-")) {
    throw new Error("Secret name must start with cloudwrxs-campaign-");
  }
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("Paste a valid HubSpot Service Key");

  try {
    await secrets.send(new CreateSecretCommand({
      Name: secretName,
      SecretString: JSON.stringify({ accessToken: token }),
      Description: "Cloudwrxs Campaign Command HubSpot Service Key"
    }));
  } catch (error) {
    if (error.name !== "ResourceExistsException") throw error;
    await secrets.send(new PutSecretValueCommand({ SecretId: secretName, SecretString: JSON.stringify({ accessToken: token }) }));
  }

  const test = await testHubSpotToken(token, selectedProperties);
  const setting = {
    settingKey: "hubspot",
    secretName,
    portalName: portalName || test.portalName || "",
    portalId: String(test.portalId || ""),
    mode: "service_key",
    syncMode,
    selectedProperties: normalizeHubSpotProperties(selectedProperties),
    lastTestedAt: test.testedAt,
    lastTestStatus: "ok",
    availableProperties: test.availableProperties,
    updatedAt: new Date().toISOString()
  };
  await put(tables.integrationSettings, setting);

  return {
    ok: true,
    ...setting
  };
}

async function testHubSpotConnection({ secretName, selectedProperties = [] }) {
  const token = await getConfiguredHubSpotToken(secretName);
  const test = await testHubSpotToken(token, selectedProperties);
  const settings = await scanAll(tables.integrationSettings);
  const current = settings.find((setting) => setting.settingKey === "hubspot") || {};
  const setting = {
    ...current,
    settingKey: "hubspot",
    secretName: secretName || current.secretName,
    portalName: current.portalName || test.portalName || "",
    portalId: String(test.portalId || ""),
    mode: current.mode || "service_key",
    syncMode: current.syncMode || "lists_and_contacts",
    selectedProperties: normalizeHubSpotProperties(selectedProperties.length ? selectedProperties : current.selectedProperties),
    lastTestedAt: test.testedAt,
    lastTestStatus: "ok",
    availableProperties: test.availableProperties,
    updatedAt: new Date().toISOString()
  };
  await put(tables.integrationSettings, setting);

  return {
    ok: true,
    ...setting
  };
}

async function saveJustCallSecret({
  accountLabel = "Cloudwrxs JustCall",
  apiKey,
  apiSecret,
  burstLimit = 30,
  dialerMode = "url_popup",
  hourlyLimit = 1800,
  secretName,
  userMappingMode = "email",
  webhookMode = "planned"
}) {
  if (!secretName || !String(secretName).startsWith("cloudwrxs-campaign-")) {
    throw new Error("Secret name must start with cloudwrxs-campaign-");
  }
  const key = String(apiKey || "").trim();
  const secret = String(apiSecret || "").trim();
  if (!key || !secret) throw new Error("Paste a valid JustCall API key and API secret");

  try {
    await secrets.send(new CreateSecretCommand({
      Name: secretName,
      SecretString: JSON.stringify({ apiKey: key, apiSecret: secret }),
      Description: "Cloudwrxs Campaign Command JustCall API credentials"
    }));
  } catch (error) {
    if (error.name !== "ResourceExistsException") throw error;
    await secrets.send(new PutSecretValueCommand({ SecretId: secretName, SecretString: JSON.stringify({ apiKey: key, apiSecret: secret }) }));
  }

  const setting = {
    settingKey: "justcall",
    secretName,
    accountLabel,
    mode: "api_key_secret",
    dialerMode,
    hourlyLimit: Number(hourlyLimit || 1800),
    burstLimit: Number(burstLimit || 30),
    webhookMode,
    userMappingMode,
    lastTestedAt: "",
    lastTestStatus: "saved",
    updatedAt: new Date().toISOString()
  };
  await put(tables.integrationSettings, setting);

  return {
    ok: true,
    ...setting
  };
}

async function testJustCallConnection({ secretName }) {
  const credentials = await getConfiguredJustCallCredentials(secretName);
  const testedAt = new Date().toISOString();
  const users = await fetchJson("https://api.justcall.io/v2.1/users?per_page=1&page=0", {
    headers: {
      Authorization: `${credentials.apiKey}:${credentials.apiSecret}`
    }
  });
  const settings = await scanAll(tables.integrationSettings);
  const current = settings.find((setting) => setting.settingKey === "justcall") || {};
  const setting = {
    ...current,
    settingKey: "justcall",
    secretName: secretName || current.secretName,
    accountLabel: current.accountLabel || "Cloudwrxs JustCall",
    mode: current.mode || "api_key_secret",
    dialerMode: current.dialerMode || "url_popup",
    hourlyLimit: Number(current.hourlyLimit || 1800),
    burstLimit: Number(current.burstLimit || 30),
    webhookMode: current.webhookMode || "planned",
    userMappingMode: current.userMappingMode || "email",
    lastTestedAt: testedAt,
    lastTestStatus: "ok",
    updatedAt: testedAt
  };
  await put(tables.integrationSettings, setting);
  const userCount = Array.isArray(users?.data) ? users.data.length : Array.isArray(users?.users) ? users.users.length : undefined;

  return {
    ok: true,
    ...setting,
    userCount,
    userCountText: Number.isFinite(userCount) ? `${userCount} user sample returned` : "User lookup succeeded"
  };
}

async function getConfiguredJustCallCredentials(secretName) {
  const settings = await scanAll(tables.integrationSettings);
  const justcall = settings.find((setting) => setting.settingKey === "justcall") || {};
  const configuredSecretName = secretName || justcall.secretName || process.env.JUSTCALL_API_SECRET_NAME;
  if (!configuredSecretName) throw new Error("JustCall API secret name is not configured");
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: configuredSecretName }));
  const raw = result.SecretString || Buffer.from(result.SecretBinary || "", "base64").toString("utf8");
  const parsed = JSON.parse(raw || "{}");
  const apiKey = String(parsed.apiKey || parsed.key || "").trim();
  const apiSecret = String(parsed.apiSecret || parsed.secret || "").trim();
  if (!apiKey || !apiSecret) throw new Error("JustCall secret must contain apiKey and apiSecret");
  return { apiKey, apiSecret };
}

async function getConfiguredHubSpotToken(secretName) {
  const settings = await scanAll(tables.integrationSettings);
  const hubspot = settings.find((setting) => setting.settingKey === "hubspot") || {};
  const configuredSecretName = secretName || hubspot.secretName || process.env.HUBSPOT_SERVICE_KEY_SECRET_NAME || process.env.HUBSPOT_PRIVATE_APP_SECRET_NAME;
  if (!configuredSecretName) throw new Error("HubSpot Service Key secret name is not configured");
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: configuredSecretName }));
  const raw = result.SecretString || Buffer.from(result.SecretBinary || "", "base64").toString("utf8");
  try {
    const parsed = JSON.parse(raw);
    return parsed.accessToken || parsed.token || raw;
  } catch {
    return raw;
  }
}

async function testHubSpotToken(accessToken, selectedProperties = []) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [account, properties] = await Promise.all([
    fetchJson("https://api.hubapi.com/account-info/2026-03/details", { headers }),
    fetchJson("https://api.hubapi.com/crm/properties/2026-03/0-1", { headers })
  ]);
  const requested = normalizeHubSpotProperties(selectedProperties);
  const availableProperties = (properties.results || [])
    .filter((property) => !requested.length || requested.includes(property.name) || requested.includes(property.label))
    .map((property) => ({
      name: property.name,
      label: property.label,
      type: property.type,
      fieldType: property.fieldType,
      options: Array.isArray(property.options) ? property.options.slice(0, 100).map((option) => ({ label: option.label, value: option.value })) : []
    }))
    .sort((a, b) => String(a.label || a.name).localeCompare(String(b.label || b.name)));

  return {
    accountType: account.accountType,
    availableProperties,
    portalId: account.portalId,
    portalName: account.uiDomain || "",
    testedAt: new Date().toISOString(),
    timeZone: account.timeZone
  };
}

function normalizeHubSpotProperties(properties = []) {
  return Array.from(new Set((Array.isArray(properties) ? properties : String(properties).split(",")).map((property) => String(property || "").trim()).filter(Boolean)));
}

const defaultHubSpotContactProperties = ["email", "firstname", "lastname", "phone", "mobilephone", "company", "jobtitle", "country", "lifecyclestage", "hubspot_owner_id"];
const hubSpotContactSyncFieldMap = {
  company: "company",
  country: "country",
  email: "email",
  firstName: "firstname",
  jobTitle: "jobtitle",
  lastName: "lastname",
  lifecycleStage: "lifecyclestage",
  phone: "phone"
};

async function searchHubSpotLists({ count = 200, hubspotImportMode = "segment", objectTypeId = "", offset = 0, query = "", secretName }) {
  const token = await getConfiguredHubSpotToken(secretName);
  const safeCount = Math.max(1, Math.min(Number(count) || 200, 500));
  const resolvedObjectTypeId = objectTypeId || (hubspotImportMode === "company_segment" ? "0-2" : "0-1");
  const result = await fetchJson("https://api.hubapi.com/crm/lists/2026-03/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      count: safeCount,
      objectTypeId: resolvedObjectTypeId,
      offset: Math.max(0, Number(offset) || 0),
      query: String(query || "")
    })
  });
  const listsById = new Map((result.lists || result.results || [])
    .map((list) => ({
      listId: String(list.listId || list.id || list.ilsListId || ""),
      name: list.name || list.listName || "",
      objectTypeId: list.objectTypeId || "",
      processingType: list.processingType || "",
      size: list.size || list.listSize || list.membershipCount || list.metaData?.size || null,
      updatedAt: list.updatedAt || list.lastUpdatedAt || ""
    }))
    .filter((list) => list.listId)
    .map((list) => [list.listId, list]));
  const trimmedQuery = String(query || "").trim();
  if (/^\d+$/.test(trimmedQuery) && !listsById.has(trimmedQuery)) {
    try {
      const directList = await fetchJson(`https://api.hubapi.com/crm/lists/2026-03/${encodeURIComponent(trimmedQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const direct = normalizeHubSpotListSummary(directList);
      if (direct.listId && (!direct.objectTypeId || direct.objectTypeId === resolvedObjectTypeId)) {
        listsById.set(direct.listId, direct);
      }
    } catch (error) {
      console.log("HubSpot direct list lookup skipped", { listId: trimmedQuery, message: error.message });
    }
  }
  const lists = Array.from(listsById.values())
    .sort((a, b) => String(a.name || a.listId).localeCompare(String(b.name || b.listId)));
  return {
    hasMore: Boolean(result.hasMore),
    lists,
    offset: result.offset ?? null,
    total: result.total ?? lists.length
  };
}

function normalizeHubSpotListSummary(raw = {}) {
  const list = raw.list || raw;
  return {
    listId: String(list.listId || list.id || list.ilsListId || ""),
    name: list.name || list.listName || "",
    objectTypeId: list.objectTypeId || "",
    processingType: list.processingType || "",
    size: list.size || list.listSize || list.membershipCount || list.metaData?.size || null,
    updatedAt: list.updatedAt || list.lastUpdatedAt || ""
  };
}

async function preferredHubSpotContactListId(fallbackListId) {
  const audienceLists = await scanAll(tables.audienceLists);
  const canonical = audienceLists
    .filter((list) => list.sourceType === "hubspot" && (list.hubspotImportMode || "") === "contacts")
    .sort((a, b) => String(b.lastImportedAt || b.updatedAt || "").localeCompare(String(a.lastImportedAt || a.updatedAt || "")))[0];
  return canonical?.listId || fallbackListId;
}

async function importHubSpotSegmentBatch({ after = "", batchSize = 100, hubspotImportMode = "segment", hubspotListId, listId, properties = [], reset = false, secretName }) {
  if (hubspotImportMode === "company_segment") {
    return importHubSpotCompanySegmentContactsBatch({ after, batchSize, hubspotListId, listId, properties, reset, secretName });
  }
  if (!listId || !hubspotListId) throw new Error("listId and hubspotListId are required");
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 100, 100));
  if (reset) {
    await deleteExistingMembershipsForList(listId);
    await deleteExistingContactsForList(listId);
  }
  const contactListId = await preferredHubSpotContactListId(listId);
  const token = await getConfiguredHubSpotToken(secretName);
  const headers = { Authorization: `Bearer ${token}` };
  const membershipParams = new URLSearchParams({ limit: String(safeBatchSize) });
  if (after) membershipParams.set("after", after);
  const membershipPage = await fetchJson(
    `https://api.hubapi.com/crm/lists/2026-03/${encodeURIComponent(hubspotListId)}/memberships?${membershipParams.toString()}`,
    { headers }
  );
  const recordIds = (membershipPage.results || [])
    .map((membership) => membership.recordId || membership.objectId || membership.id)
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const requestedProperties = await selectedHubSpotImportProperties(properties);
  const records = recordIds.length
    ? await readHubSpotContactRecords({ headers, properties: requestedProperties, recordIds })
    : [];
  const contacts = hubSpotRecordsToAudienceContacts({
    hubspotListId,
    importMode: "segment",
    listId: contactListId,
    records,
    sourceName: `HubSpot segment ${hubspotListId}`
  });
  const upsertedContacts = await upsertHubSpotContacts(contacts);
  const membershipRows = upsertedContacts.map((contact) => ({
    listId,
    contactId: contact.contactId,
    contactListId,
    hubspotRecordId: contact.hubspotRecordId,
    sourceHubSpotListId: hubspotListId,
    sourceImportMode: "segment",
    sourceName: `HubSpot segment ${hubspotListId}`,
    updatedAt: new Date().toISOString()
  }));
  await batchPut(tables.audienceMemberships, membershipRows);
  const nextAfter = membershipPage.paging?.next?.after || "";
  return {
    done: !nextAfter,
    hubspotListId,
    imported: membershipRows.length,
    listId,
    nextAfter,
    previewContacts: upsertedContacts.slice(0, 25),
    readMemberships: recordIds.length,
    skipped: recordIds.length - membershipRows.length
  };
}

async function importHubSpotCompanySegmentContactsBatch({ after = "", batchSize = 50, hubspotListId, listId, properties = [], reset = false, secretName }) {
  if (!listId || !hubspotListId) throw new Error("listId and hubspotListId are required");
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 50, 100));
  if (reset) {
    await deleteExistingMembershipsForList(listId);
    await deleteExistingContactsForList(listId);
  }
  const contactListId = await preferredHubSpotContactListId(listId);
  const token = await getConfiguredHubSpotToken(secretName);
  const headers = { Authorization: `Bearer ${token}` };
  const membershipParams = new URLSearchParams({ limit: String(safeBatchSize) });
  if (after) membershipParams.set("after", after);
  const membershipPage = await fetchJson(
    `https://api.hubapi.com/crm/lists/2026-03/${encodeURIComponent(hubspotListId)}/memberships?${membershipParams.toString()}`,
    { headers }
  );
  const companyIds = (membershipPage.results || [])
    .map((membership) => membership.recordId || membership.objectId || membership.id)
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const [companyRecords, companyContactLinks] = await Promise.all([
    companyIds.length ? readHubSpotCompanyRecords({ headers, recordIds: companyIds }) : [],
    companyIds.length ? readHubSpotCompanyContactAssociations({ headers, companyIds }) : []
  ]);
  const companyById = new Map(companyRecords.map((company) => [String(company.id || ""), company]));
  const contactCompanyIds = new Map();
  for (const link of companyContactLinks) {
    if (!link.contactId || !link.companyId) continue;
    if (!contactCompanyIds.has(link.contactId)) contactCompanyIds.set(link.contactId, []);
    contactCompanyIds.get(link.contactId).push(link.companyId);
  }
  const contactIds = Array.from(contactCompanyIds.keys());
  const requestedProperties = await selectedHubSpotImportProperties(properties);
  const records = contactIds.length
    ? await readHubSpotContactRecords({ headers, properties: requestedProperties, recordIds: contactIds })
    : [];
  const contacts = hubSpotRecordsToAudienceContacts({
    hubspotListId,
    importMode: "company_segment",
    listId: contactListId,
    records,
    sourceName: `HubSpot company segment ${hubspotListId}`
  }).map((contact) => {
    const companyIdsForContact = contactCompanyIds.get(contact.hubspotRecordId) || [];
    const primaryCompany = companyById.get(companyIdsForContact[0]) || {};
    const companyProperties = primaryCompany.properties || {};
    return {
      ...contact,
      company: contact.company || companyProperties.name || "",
      companyDomain: contact.companyDomain || companyProperties.domain || "",
      country: contact.country || companyProperties.country || "",
      sourceHubSpotCompanyId: companyIdsForContact[0] || "",
      sourceHubSpotCompanyIds: companyIdsForContact,
      sourceHubSpotCompanyName: companyProperties.name || "",
      sourceImportMode: "company_segment"
    };
  });
  const upsertedContacts = await upsertHubSpotContacts(contacts);
  const membershipRows = upsertedContacts.map((contact) => ({
    listId,
    contactId: contact.contactId,
    contactListId,
    hubspotRecordId: contact.hubspotRecordId,
    sourceHubSpotCompanyId: contact.sourceHubSpotCompanyId || "",
    sourceHubSpotCompanyIds: contact.sourceHubSpotCompanyIds || [],
    sourceHubSpotCompanyListId: hubspotListId,
    sourceHubSpotListId: hubspotListId,
    sourceImportMode: "company_segment",
    sourceName: `HubSpot company segment ${hubspotListId}`,
    updatedAt: new Date().toISOString()
  }));
  await batchPut(tables.audienceMemberships, membershipRows);
  const nextAfter = membershipPage.paging?.next?.after || "";
  return {
    associatedContacts: contactIds.length,
    done: !nextAfter,
    hubspotListId,
    imported: membershipRows.length,
    listId,
    nextAfter,
    previewContacts: upsertedContacts.slice(0, 25),
    readCompanies: companyIds.length,
    readMemberships: companyIds.length,
    skipped: contactIds.length - membershipRows.length
  };
}

async function importHubSpotContactsBatch({ after = "", batchSize = 100, listId, properties = [], reset = false, secretName }) {
  if (!listId) throw new Error("listId is required");
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 100, 100));
  if (reset) await deleteExistingContactsForList(listId);
  const token = await getConfiguredHubSpotToken(secretName);
  const headers = { Authorization: `Bearer ${token}` };
  const requestedProperties = await selectedHubSpotImportProperties(properties);
  const params = new URLSearchParams({
    archived: "false",
    limit: String(safeBatchSize)
  });
  requestedProperties.forEach((property) => params.append("properties", property));
  if (after) params.set("after", after);
  const result = await fetchJson(`https://api.hubapi.com/crm/objects/2026-03/0-1?${params.toString()}`, { headers });
  const records = result.results || [];
  const contacts = hubSpotRecordsToAudienceContacts({
    importMode: "contacts",
    listId,
    records,
    sourceName: "HubSpot contacts"
  });
  const upsertedContacts = await upsertHubSpotContacts(contacts);
  const nextAfter = result.paging?.next?.after || "";
  return {
    done: !nextAfter,
    imported: contacts.length,
    listId,
    nextAfter,
    previewContacts: upsertedContacts.slice(0, 25),
    readContacts: records.length,
    skipped: records.length - contacts.length
  };
}

async function exportAudienceToHubSpotSegment({ audienceListId, createCompanies = false, hubspotListName = "", limit = 500, secretName }) {
  if (!audienceListId) throw new Error("audienceListId is required");
  const audienceList = await getAudienceList(audienceListId);
  if (!audienceList) throw new Error("Audience list not found");
  const token = await getConfiguredHubSpotToken(secretName);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const compliance = await loadComplianceIndex();
  const resolvedContacts = (await resolveContactsForAudienceList(audienceList, compliance))
    .filter((contact) => emailKey(contact.email) && !compliance[emailKey(contact.email)]?.suppressed)
    .slice(0, safeLimit);
  if (!resolvedContacts.length) throw new Error("No sendable contacts with email addresses were found for this audience");

  const upsertedContacts = [];
  for (const chunk of chunkArray(resolvedContacts, 100)) {
    const result = await fetchJson("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs: chunk.map((contact) => ({
          id: emailKey(contact.email),
          idProperty: "email",
          properties: hubSpotContactPropertiesForExport(contact)
        }))
      })
    });
    upsertedContacts.push(...(result.results || []).map((record) => ({
      id: String(record.id || ""),
      email: emailKey(record.properties?.email || record.id || "")
    })).filter((record) => record.id));
  }

  const recordIds = Array.from(new Set(upsertedContacts.map((record) => record.id).filter(Boolean)));
  if (!recordIds.length) throw new Error("HubSpot did not return contact record IDs for the exported audience");

  const listName = String(hubspotListName || audienceList.name || `Campaign Command audience ${new Date().toISOString().slice(0, 10)}`).trim();
  const hubspotList = await fetchJson("https://api.hubapi.com/crm/lists/2026-03", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: listName,
      objectTypeId: "0-1",
      processingType: "MANUAL"
    })
  });
  const hubspotListId = String(hubspotList.listId || hubspotList.id || "");
  if (!hubspotListId) throw new Error("HubSpot segment was created but no listId was returned");

  for (const chunk of chunkArray(recordIds, 500)) {
    await fetchJson(`https://api.hubapi.com/crm/lists/2026-03/${encodeURIComponent(hubspotListId)}/memberships/add`, {
      method: "PUT",
      headers,
      body: JSON.stringify(chunk)
    });
  }

  const recordIdByEmail = new Map(upsertedContacts.map((record) => [record.email, record.id]));
  const syncedAt = new Date().toISOString();
  for (const contact of resolvedContacts) {
    const hubspotRecordId = recordIdByEmail.get(emailKey(contact.email));
    if (!hubspotRecordId) continue;
    await put(tables.audienceContacts, {
      ...contact,
      email: emailKey(contact.email),
      hubspotRecordId,
      hubspotSyncedAt: syncedAt,
      hubspotSyncStatus: "synced",
      sourceType: contact.sourceType || "exported_to_hubspot",
      updatedAt: syncedAt
    });
  }

  const nextAudienceList = {
    ...audienceList,
    exportSourceType: audienceList.sourceType || "internal",
    hubspotExportedAt: syncedAt,
    hubspotListId,
    hubspotListName: listName,
    hubspotSyncMode: "hubspot_segment",
    sourceType: "hubspot",
    status: "hubspot_synced",
    updatedAt: syncedAt
  };
  await put(tables.audienceLists, nextAudienceList);
  await writeHubSpotSyncAudit({
    action: "audience_export",
    contact: {
      contactId: `audience-${audienceListId}`,
      email: ""
    },
    detail: `Exported audience "${audienceList.name || audienceListId}" to HubSpot segment "${listName}" (${recordIds.length} contacts)`,
    hubspotObjectId: hubspotListId,
    syncedAt,
    syncedFields: ["contacts", "segment"]
  });

  return {
    audienceList: nextAudienceList,
    companiesRequested: Boolean(createCompanies),
    companiesCreated: 0,
    companyCreationStatus: createCompanies ? "deferred_to_next_phase" : "not_requested",
    contactsExported: recordIds.length,
    contactsResolved: resolvedContacts.length,
    hubspotListId,
    hubspotListName: listName,
    limited: resolvedContacts.length >= safeLimit,
    ok: true
  };
}

async function syncAudienceSuppressions({ removeFromHubSpotSegments = true, secretName } = {}) {
  const syncedAt = new Date().toISOString();
  const compliance = await loadComplianceIndex();
  const suppressedEmails = new Set(
    Object.entries(compliance)
      .filter(([, value]) => value?.suppressed)
      .map(([email]) => email)
  );
  if (!suppressedEmails.size) {
    return {
      ok: true,
      checkedAt: syncedAt,
      suppressedEmails: 0,
      listsChecked: 0,
      listsUpdated: 0,
      contactsSuppressed: 0,
      hubspotMembershipsRemoved: 0
    };
  }

  const audienceLists = await scanAll(tables.audienceLists);
  const reusableLists = audienceLists.filter((list) => list.sourceListId);
  let hubspotHeaders = null;
  let hubspotStatus = removeFromHubSpotSegments ? "not_needed" : "disabled";
  if (removeFromHubSpotSegments && reusableLists.some((list) => list.hubspotListId)) {
    try {
      const token = await getConfiguredHubSpotToken(secretName);
      hubspotHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      hubspotStatus = "ready";
    } catch (error) {
      hubspotStatus = `skipped: ${error.message}`;
    }
  }

  const suppressedContactKeys = new Map();
  const updatedLists = [];
  let contactsSuppressed = 0;
  let frozenContactsRemoved = 0;
  let excludedContactsAdded = 0;
  let hubspotMembershipsRemoved = 0;
  const hubspotErrors = [];

  for (const audienceList of reusableLists) {
    const suppressedContacts = await suppressedContactsForAudienceList(audienceList, suppressedEmails);
    if (!suppressedContacts.length) continue;

    const suppressedIds = new Set(suppressedContacts.map((contact) => contact.contactId).filter(Boolean));
    const existingExcluded = new Set(audienceList.excludedContactIds || []);
    const existingFrozen = new Set(audienceList.frozenContactIds || []);
    const nextExcluded = new Set(existingExcluded);
    const nextFrozen = new Set(existingFrozen);

    if (audienceList.frozen) {
      for (const contactId of suppressedIds) {
        if (nextFrozen.delete(contactId)) frozenContactsRemoved += 1;
      }
    } else {
      for (const contactId of suppressedIds) {
        if (!nextExcluded.has(contactId)) {
          nextExcluded.add(contactId);
          excludedContactsAdded += 1;
        }
      }
    }

    suppressedContacts.forEach((contact) => {
      const key = `${contact.contactListId || contact.listId}:${contact.contactId}`;
      suppressedContactKeys.set(key, contact);
    });

    const listChanged = nextExcluded.size !== existingExcluded.size || nextFrozen.size !== existingFrozen.size;
    let removedForList = 0;
    if (hubspotHeaders && audienceList.hubspotListId) {
      const recordIds = await hubSpotRecordIdsForContacts(suppressedContacts);
      for (const chunk of chunkArray(recordIds, 500)) {
        try {
          await fetchJson(`https://api.hubapi.com/crm/lists/2026-03/${encodeURIComponent(audienceList.hubspotListId)}/memberships/remove`, {
            method: "PUT",
            headers: hubspotHeaders,
            body: JSON.stringify(chunk)
          });
          hubspotMembershipsRemoved += chunk.length;
          removedForList += chunk.length;
        } catch (error) {
          hubspotErrors.push({
            hubspotListId: audienceList.hubspotListId,
            listId: audienceList.listId,
            message: error.message
          });
        }
      }
    }

    if (listChanged || removedForList) {
      const nextAudienceList = {
        ...audienceList,
        excludedContactIds: Array.from(nextExcluded),
        frozenContactIds: Array.from(nextFrozen),
        suppressionSyncedAt: syncedAt,
        suppressionSyncSummary: {
          frozenContactsRemoved: nextFrozen.size < existingFrozen.size ? existingFrozen.size - nextFrozen.size : 0,
          hubspotMembershipsRemoved: removedForList,
          suppressedContacts: suppressedContacts.length,
          updatedAt: syncedAt
        },
        updatedAt: syncedAt
      };
      await put(tables.audienceLists, nextAudienceList);
      updatedLists.push({
        frozenContactsRemoved: nextAudienceList.suppressionSyncSummary.frozenContactsRemoved,
        hubspotMembershipsRemoved: removedForList,
        listId: audienceList.listId,
        name: audienceList.name || "",
        suppressedContacts: suppressedContacts.length
      });
    }
  }

  for (const contact of suppressedContactKeys.values()) {
    const email = emailKey(contact.email);
    const suppression = compliance[email] || {};
    await put(tables.audienceContacts, {
      ...contact,
      listId: contact.contactListId || contact.listId,
      email,
      emailStatus: suppression.reason || "suppressed",
      suppressionReason: suppression.reason || "suppressed",
      suppressionStatus: "suppressed",
      suppressionSyncedAt: syncedAt,
      updatedAt: syncedAt
    });
    contactsSuppressed += 1;
  }

  if (updatedLists.length || contactsSuppressed || hubspotMembershipsRemoved) {
    await writeHubSpotSyncAudit({
      action: "suppression_sync",
      contact: {
        contactId: "audience-suppression-sync",
        email: ""
      },
      detail: `Suppression sync removed ${contactsSuppressed} contacts from reusable audiences and ${hubspotMembershipsRemoved} HubSpot segment memberships.`,
      hubspotObjectId: "",
      syncedAt,
      syncedFields: ["audienceLists", "hubspotListMemberships", "suppressionStatus"]
    });
  }

  return {
    ok: true,
    checkedAt: syncedAt,
    contactsSuppressed,
    excludedContactsAdded,
    frozenContactsRemoved,
    hubspotErrors,
    hubspotMembershipsRemoved,
    hubspotStatus,
    listsChecked: reusableLists.length,
    listsUpdated: updatedLists.length,
    suppressedEmails: suppressedEmails.size,
    updatedLists
  };
}

async function suppressedContactsForAudienceList(audienceList, suppressedEmails) {
  const sourceContacts = await loadAudienceContactsForList(audienceList.sourceListId || audienceList.listId);
  const filters = (Array.isArray(audienceList.filters) ? audienceList.filters : [])
    .filter((filter) => filter.field !== "emailStatus");
  const excluded = new Set(audienceList.excludedContactIds || []);
  const frozen = new Set(audienceList.frozenContactIds || []);
  const context = await buildAudienceFilterContext(filters, {});
  return sourceContacts.filter((contact) => {
    if (!suppressedEmails.has(emailKey(contact.email))) return false;
    if (audienceList.frozen) return frozen.has(contact.contactId);
    if (excluded.has(contact.contactId)) return false;
    if (!filters.length) return true;
    return contactMatchesAudienceFilters(contact, filters, {}, context);
  });
}

async function hubSpotRecordIdsForContacts(contacts = []) {
  const recordIds = new Set();
  for (const contact of contacts) {
    if (contact.hubspotRecordId) {
      recordIds.add(String(contact.hubspotRecordId));
      continue;
    }
    const email = emailKey(contact.email);
    if (!email) continue;
    const matchingContacts = await findContactsByEmail(email);
    matchingContacts
      .map((item) => String(item.hubspotRecordId || "").trim())
      .filter(Boolean)
      .forEach((id) => recordIds.add(id));
  }
  return Array.from(recordIds);
}

function hubSpotContactPropertiesForExport(contact = {}) {
  const properties = {
    company: contact.company || "",
    country: contact.country || "",
    email: emailKey(contact.email),
    firstname: contact.firstName || "",
    jobtitle: contact.jobTitle || "",
    lastname: contact.lastName || "",
    lifecyclestage: contact.lifecycleStage || "",
    phone: contact.phone || ""
  };
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => String(value || "").trim()));
}

async function selectedHubSpotImportProperties(properties = []) {
  const requested = normalizeHubSpotProperties(properties);
  if (requested.length) return Array.from(new Set(["email", ...requested]));
  const settings = await scanAll(tables.integrationSettings);
  const hubspot = settings.find((setting) => setting.settingKey === "hubspot") || {};
  return Array.from(new Set(["email", ...normalizeHubSpotProperties(hubspot.selectedProperties || defaultHubSpotContactProperties)]));
}

async function readHubSpotContactRecords({ headers, properties, recordIds }) {
  const records = [];
  for (let index = 0; index < recordIds.length; index += 100) {
    const result = await fetchJson("https://api.hubapi.com/crm/objects/2026-03/0-1/batch/read", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties,
        inputs: recordIds.slice(index, index + 100).map((id) => ({ id }))
      })
    });
    records.push(...(result.results || []));
  }
  return records;
}

async function readHubSpotCompanyRecords({ headers, recordIds }) {
  const records = [];
  for (let index = 0; index < recordIds.length; index += 100) {
    const result = await fetchJson("https://api.hubapi.com/crm/objects/2026-03/0-2/batch/read", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: ["name", "domain", "country", "industry", "lifecyclestage", "hubspot_owner_id"],
        inputs: recordIds.slice(index, index + 100).map((id) => ({ id }))
      })
    });
    records.push(...(result.results || []));
  }
  return records;
}

async function readHubSpotCompanyContactAssociations({ headers, companyIds }) {
  const links = [];
  let pending = companyIds.map((id) => ({ id }));
  let pageGuard = 0;
  while (pending.length && pageGuard < 20) {
    const nextPending = [];
    for (let index = 0; index < pending.length; index += 1000) {
      const inputs = pending.slice(index, index + 1000);
      const result = await fetchJson("https://api.hubapi.com/crm/v4/associations/companies/contacts/batch/read", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs })
      });
      for (const row of result.results || []) {
        const companyId = String(row.from?.id || row.fromId || row.id || "").trim();
        const associatedContacts = Array.isArray(row.to) ? row.to : [];
        for (const associated of associatedContacts) {
          const contactId = String(associated.toObjectId || associated.id || associated.to?.id || "").trim();
          if (companyId && contactId) links.push({ companyId, contactId });
        }
        const after = row.paging?.next?.after;
        if (companyId && after) nextPending.push({ id: companyId, after });
      }
    }
    pending = nextPending;
    pageGuard += 1;
  }
  return links;
}

function hubSpotRecordsToAudienceContacts({ hubspotListId = "", importMode, listId, records = [], sourceName }) {
  return records
    .map((record) => {
      const properties = record.properties || {};
      const email = String(properties.email || "").trim().toLowerCase();
      return {
        listId,
        contactId: `hubspot-${listId}-${record.id}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
        firstName: properties.firstname || "",
        lastName: properties.lastname || "",
        email,
        phone: properties.phone || properties.mobilephone || "",
        country: properties.country || "",
        technology: properties.technology || properties.technologies || "",
        persona: properties.persona || "",
        jobTitle: properties.jobtitle || "",
        lifecycleStage: properties.lifecyclestage || "",
        company: properties.company || "",
        owner: properties.hubspot_owner_id || properties.owner || "",
        hubspotRecordId: String(record.id || ""),
        sourceHubSpotListId: hubspotListId,
        sourceImportMode: importMode,
        sourceName
      };
    })
    .filter((contact) => contact.email && contact.email.includes("@"));
}

async function upsertHubSpotContacts(contacts = []) {
  const upserted = [];
  for (const contact of contacts) {
    const existingContacts = await findContactsByEmail(contact.email);
    const existingForMerge = existingContacts.find((item) => item.listId !== contact.listId || item.contactId !== contact.contactId);
    const merged = existingForMerge ? mergeImportedContact(contact, existingForMerge) : contact;
    await put(tables.audienceContacts, { ...merged, updatedAt: new Date().toISOString() });
    for (const existing of existingContacts) {
      if (existing.listId === merged.listId && existing.contactId === merged.contactId) continue;
      await moveMembershipsToContact(existing, merged);
    }
    upserted.push(merged);
  }
  return upserted;
}

async function findContactsByEmail(email) {
  const result = await dynamo.send(new QueryCommand({
    TableName: tables.audienceContacts,
    IndexName: "ContactEmailIndex",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": { S: emailKey(email) }
    }
  }));
  return (result.Items || []).map(fromDynamoItem);
}

async function moveMembershipsToContact(fromContact, toContact) {
  if (!fromContact?.listId || !fromContact?.contactId || !toContact?.listId || !toContact?.contactId) return;
  const result = await dynamo.send(new QueryCommand({
    TableName: tables.audienceMemberships,
    IndexName: "ContactMembershipLookupIndex",
    KeyConditionExpression: "contactListId = :contactListId AND contactId = :contactId",
    ExpressionAttributeValues: {
      ":contactListId": { S: fromContact.listId },
      ":contactId": { S: fromContact.contactId }
    }
  }));
  const memberships = (result.Items || []).map(fromDynamoItem);
  if (!memberships.length) return;
  const nextMemberships = memberships.map((membership) => ({
    ...membership,
    contactId: toContact.contactId,
    contactListId: toContact.listId,
    email: toContact.email || membership.email || "",
    hubspotRecordId: toContact.hubspotRecordId || membership.hubspotRecordId || "",
    updatedAt: new Date().toISOString()
  }));
  await batchPut(tables.audienceMemberships, nextMemberships);
  await batchDelete(tables.audienceMemberships, memberships.map((membership) => ({
    listId: membership.listId,
    contactId: membership.contactId
  })));
}

async function syncHubSpotContact({ contact, fields = [], secretName }) {
  if (!contact?.listId || !contact?.contactId) throw new Error("contact.listId and contact.contactId are required");
  if (!contact.hubspotRecordId) throw new Error("This contact is not linked to a HubSpot record");
  const viewListId = contact.listId;
  const contactListId = contact.contactListId || contact.listId;
  const requestedFields = Array.isArray(fields) && fields.length ? fields : Object.keys(hubSpotContactSyncFieldMap);
  const properties = Object.fromEntries(
    requestedFields
      .filter((field) => hubSpotContactSyncFieldMap[field])
      .map((field) => [hubSpotContactSyncFieldMap[field], field === "email" ? String(contact[field] || "").toLowerCase() : String(contact[field] || "")])
  );
  if (!Object.keys(properties).length) throw new Error("No HubSpot-syncable fields changed");
  const token = await getConfiguredHubSpotToken(secretName);
  const syncedAt = new Date().toISOString();
  const hubspotResult = await fetchJson(`https://api.hubapi.com/crm/objects/2026-03/0-1/${encodeURIComponent(contact.hubspotRecordId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ properties })
  });
  const item = {
    ...contact,
    listId: contactListId,
    email: String(contact.email || "").toLowerCase(),
    hubspotSyncError: "",
    hubspotSyncFields: Object.keys(properties),
    hubspotSyncStatus: "synced",
    hubspotSyncedAt: syncedAt,
    updatedAt: syncedAt
  };
  await put(tables.audienceContacts, item);
  await writeHubSpotSyncAudit({
    action: "contact_update",
    contact: item,
    detail: `Updated HubSpot contact fields: ${Object.keys(properties).join(", ")}`,
    hubspotObjectId: contact.hubspotRecordId,
    syncedAt,
    syncedFields: Object.keys(properties)
  });
  return {
    contact: contactListId === viewListId
      ? item
      : { ...item, listId: viewListId, contactListId },
    hubspotRecordId: contact.hubspotRecordId,
    ok: true,
    syncedFields: Object.keys(properties),
    hubspotUpdatedAt: hubspotResult.updatedAt || ""
  };
}

async function syncHubSpotLeadCall({ contact, engagement, ownerProfile, secretName }) {
  if (!contact?.contactId) throw new Error("contact.contactId is required");
  if (!engagement?.eventId || !engagement?.contactId) throw new Error("engagement.eventId and engagement.contactId are required");
  if (!contact.hubspotRecordId) throw new Error("This contact is not linked to a HubSpot record");

  const token = await getConfiguredHubSpotToken(secretName);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  const syncedAt = new Date().toISOString();
  const noteBody = buildHubSpotLeadCallNoteBody({ contact, engagement, syncedAt });
  const noteProperties = {
    hs_note_body: noteBody,
    hs_timestamp: hubSpotTimestamp(engagement.completedAt || engagement.callStartedAt || engagement.updatedAt || engagement.eventAt || syncedAt)
  };

  const noteResult = engagement.hubspotNoteId
    ? await fetchJson(`https://api.hubapi.com/crm/v3/objects/notes/${encodeURIComponent(engagement.hubspotNoteId)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ properties: noteProperties })
    })
    : await fetchJson("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: noteProperties,
        associations: [{
          to: { id: contact.hubspotRecordId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }]
        }]
      })
    });

  let taskResult = null;
  if (shouldCreateHubSpotLeadTask(engagement)) {
    const ownerId = await resolveHubSpotOwnerId({ contact, headers, ownerProfile });
    const taskProperties = {
      hs_timestamp: hubSpotTimestamp(engagement.callbackAt || engagement.dueDate || syncedAt),
      hs_task_body: noteBody,
      hs_task_priority: "HIGH",
      hs_task_status: "NOT_STARTED",
      hs_task_subject: leadTaskSubject(contact, engagement),
      hs_task_type: "CALL"
    };
    if (ownerId) taskProperties.hubspot_owner_id = ownerId;
    taskResult = engagement.hubspotTaskId
      ? await fetchJson(`https://api.hubapi.com/crm/v3/objects/tasks/${encodeURIComponent(engagement.hubspotTaskId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ properties: taskProperties })
      })
      : await fetchJson("https://api.hubapi.com/crm/v3/objects/tasks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          properties: taskProperties,
          associations: [{
            to: { id: contact.hubspotRecordId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }]
          }]
        })
      });
  }

  const updatedEngagement = {
    ...engagement,
    email: emailKey(engagement.email || contact.email),
    hubspotNoteId: String(noteResult.id || engagement.hubspotNoteId || ""),
    hubspotSyncError: "",
    hubspotSyncStatus: "synced",
    hubspotSyncedAt: syncedAt,
    hubspotTaskError: "",
    hubspotTaskId: taskResult ? String(taskResult.id || engagement.hubspotTaskId || "") : engagement.hubspotTaskId || "",
    hubspotTaskStatus: taskResult ? "synced" : engagement.hubspotTaskStatus || "",
    updatedAt: syncedAt
  };
  await put(tables.contactEngagement, updatedEngagement);
  await writeHubSpotSyncAudit({
    action: "lead_call_sync",
    contact,
    detail: `Synced Lead Nurture call note${updatedEngagement.hubspotTaskId ? " and callback task" : ""}`,
    engagement,
    hubspotObjectId: contact.hubspotRecordId,
    syncedAt,
    syncedFields: ["note", updatedEngagement.hubspotTaskId ? "task" : ""].filter(Boolean)
  });

  return {
    engagement: updatedEngagement,
    hubspotContactId: contact.hubspotRecordId,
    noteId: updatedEngagement.hubspotNoteId,
    ok: true,
    taskId: updatedEngagement.hubspotTaskId || ""
  };
}

function shouldCreateHubSpotLeadTask(engagement = {}) {
  return Boolean(engagement.callbackAt || ["Callback requested", "Voicemail"].includes(engagement.outcome));
}

function buildHubSpotLeadCallNoteBody({ contact, engagement, syncedAt }) {
  const lines = [
    `LNCC: campaignId=${engagement.campaignId || ""}; taskId=${engagement.taskId || ""}; contactId=${engagement.contactId || ""}; eventId=${engagement.eventId || ""}`,
    `Campaign: ${engagement.campaignName || engagement.campaignId || ""}`,
    `Call step: ${engagement.taskTitle || engagement.taskId || ""}`,
    `Contact: ${contactNameForHubSpot(contact)} (${contact.email || "no email"})`,
    `Company: ${contact.company || "No company"}`,
    `Phone: ${contact.phone || "No phone"}`,
    `Outcome: ${engagement.outcome || "Not set"}`,
    `Status: ${engagement.status || "queued"}`,
    `Due date: ${engagement.dueDate || "Not set"}`,
    `Callback: ${engagement.callbackAt || "Not set"}`,
    `Next action: ${engagement.nextAction || "Not set"}`,
    `JustCall mode: ${engagement.justcallDialerMode || "Not set"}`,
    `Synced by Campaign Command: ${syncedAt}`,
    "",
    "Notes:",
    engagement.notes || "No notes recorded yet."
  ];
  return lines.map((line) => escapeHtml(line)).join("<br/>");
}

function leadTaskSubject(contact = {}, engagement = {}) {
  const company = contact.company ? ` at ${contact.company}` : "";
  const action = engagement.outcome === "Voicemail" ? "Call back after voicemail" : "Call back";
  return `LNCC: ${action} ${contactNameForHubSpot(contact)}${company}`;
}

function contactNameForHubSpot(contact = {}) {
  return `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email || "Unnamed contact";
}

async function resolveHubSpotOwnerId({ contact = {}, headers, ownerProfile = {} }) {
  const configuredOwnerId = String(ownerProfile.hubspotOwnerId || "").trim();
  if (/^\d+$/.test(configuredOwnerId)) return configuredOwnerId;
  const profileEmail = String(ownerProfile.email || "").trim();
  if (profileEmail) {
    const result = await fetchJson(`https://api.hubapi.com/crm/v3/owners/?email=${encodeURIComponent(profileEmail)}&archived=false`, { headers });
    const owner = (result.results || []).find((item) => String(item.email || "").toLowerCase() === profileEmail.toLowerCase()) || result.results?.[0];
    if (owner?.id) return String(owner.id);
  }
  const contactOwner = String(contact.owner || "").trim();
  return /^\d+$/.test(contactOwner) ? contactOwner : "";
}

async function writeHubSpotSyncAudit({ action, contact = {}, detail = "", engagement = {}, hubspotObjectId = "", syncedAt = new Date().toISOString(), syncedFields = [] }) {
  const contactId = contact.contactId || engagement.contactId || canonicalContactIdForEmail(contact.email || engagement.email || "");
  if (!contactId) return;
  await put(tables.contactEngagement, {
    contactId,
    campaignId: engagement.campaignId || "",
    detail,
    email: emailKey(contact.email || engagement.email),
    eventAt: syncedAt,
    eventId: `hubspot-sync-${action}-${Date.now()}-${createHash("sha1").update(`${contactId}:${hubspotObjectId}:${syncedAt}`).digest("hex").slice(0, 8)}`,
    eventType: "HubSpot Sync",
    hubspotObjectId,
    source: "hubspot",
    syncedFields,
    updatedAt: syncedAt
  });
}

function hubSpotTimestamp(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readGoogleSheet({ maxRows = 5000, range = "A:Z", sheetId, tabName }) {
  if (!sheetId || !tabName) throw new Error("sheetId and tabName are required");
  const serviceAccount = await getConfiguredGoogleServiceAccount();
  const token = await getGoogleAccessToken(serviceAccount);
  const rows = await fetchGoogleSheetRows({ range, sheetId, tabName, token });
  return {
    limited: rows.length > Number(maxRows),
    rows: rows.slice(0, Number(maxRows)),
    serviceAccountEmail: serviceAccount.client_email,
    totalRowsRead: rows.length,
    tabName,
    sheetId
  };
}

async function upsertImportedContactsAsMemberships({ contacts = [], contactSourceType, listId, sourceName }) {
  const membershipMap = new Map();
  const previewContacts = [];
  for (const contact of contacts) {
    const canonical = await resolveCanonicalContact(contact, listId);
    await put(tables.audienceContacts, canonical);
    const membership = {
      listId,
      contactId: canonical.contactId,
      contactListId: canonical.listId,
      email: canonical.email,
      hubspotRecordId: canonical.hubspotRecordId || "",
      sourceImportMode: contactSourceType,
      sourceName,
      sourceRowNumber: contact.sourceRowNumber || "",
      sourceSheetId: contact.sourceSheetId || "",
      sourceSheetTabName: contact.sourceSheetTabName || "",
      updatedAt: new Date().toISOString()
    };
    membershipMap.set(`${membership.listId}:${membership.contactId}`, membership);
    if (previewContacts.length < 25) previewContacts.push({ ...canonical, listId, contactListId: canonical.listId });
  }
  const membershipRows = Array.from(membershipMap.values());
  await batchPut(tables.audienceMemberships, membershipRows);
  return { membershipRows, previewContacts };
}

async function resolveCanonicalContact(contact, sourceListId) {
  const email = emailKey(contact.email);
  if (!email) return contact;
  const existing = await findPreferredContactByEmail(email, sourceListId);
  if (existing) return mergeImportedContact(existing, contact);
  return {
    ...contact,
    listId: canonicalEmailContactListId,
    contactId: canonicalContactIdForEmail(email),
    email,
    sourceImportMode: contact.sourceImportMode || "canonical_email",
    sourceName: contact.sourceName || "Canonical email contact"
  };
}

async function findPreferredContactByEmail(email, sourceListId = "") {
  const result = await dynamo.send(new QueryCommand({
    TableName: tables.audienceContacts,
    IndexName: "ContactEmailIndex",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": { S: emailKey(email) }
    }
  }));
  const contacts = (result.Items || []).map(fromDynamoItem);
  return contacts.sort((a, b) => contactPreferenceScore(b, sourceListId) - contactPreferenceScore(a, sourceListId))[0] || null;
}

function contactPreferenceScore(contact, sourceListId = "") {
  let score = 0;
  if (contact.hubspotRecordId) score += 100;
  if (contact.listId === canonicalEmailContactListId) score += 50;
  if (contact.listId && contact.listId !== sourceListId) score += 10;
  return score;
}

function mergeImportedContact(existing, incoming) {
  const merged = { ...existing };
  const mergeFields = ["firstName", "lastName", "phone", "country", "technology", "persona", "jobTitle", "lifecycleStage", "company", "owner"];
  mergeFields.forEach((field) => {
    if (!String(merged[field] || "").trim() && String(incoming[field] || "").trim()) merged[field] = incoming[field];
  });
  merged.email = emailKey(existing.email || incoming.email);
  merged.updatedAt = new Date().toISOString();
  return merged;
}

function canonicalContactIdForEmail(email) {
  return `email-${createHash("sha256").update(emailKey(email)).digest("hex").slice(0, 24)}`;
}

async function importGoogleSheetBatch({ batchSize = 1000, columnMap: requestedColumnMap, headers, listId, range = "A:Z", reset = false, sheetId, startRow = 2, tabName }) {
  if (!listId || !sheetId || !tabName) throw new Error("listId, sheetId, and tabName are required");
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 1000, 1500));
  const serviceAccount = await getConfiguredGoogleServiceAccount();
  const token = await getGoogleAccessToken(serviceAccount);
  if (reset) {
    await deleteExistingMembershipsForList(listId);
    await deleteExistingContactsForList(listId);
  }
  let headerRow = Array.isArray(headers) && headers.length ? headers : [];
  let dataRows = [];
  if (headerRow.length) {
    dataRows = await fetchGoogleSheetRows({ range: rowRange(range, Number(startRow), Number(startRow) + safeBatchSize - 1), sheetId, tabName, token });
  } else if (Number(startRow) === 2) {
    const firstRows = await fetchGoogleSheetRows({ range: rowRange(range, 1, Number(startRow) + safeBatchSize - 1), sheetId, tabName, token });
    headerRow = firstRows[0] || [];
    dataRows = firstRows.slice(1);
  } else {
    const headerRows = await fetchGoogleSheetRows({ range: rowRange(range, 1, 1), sheetId, tabName, token });
    headerRow = headerRows[0] || [];
    dataRows = await fetchGoogleSheetRows({ range: rowRange(range, Number(startRow), Number(startRow) + safeBatchSize - 1), sheetId, tabName, token });
  }
  const mapping = requestedColumnMap
    ? {
        columnMap: normalizeSheetColumnMap(requestedColumnMap, headerRow),
        mappingMode: "cached",
        mappingConfidence: null,
        mappingNotes: []
      }
    : await buildSheetColumnMap(headerRow, dataRows.slice(0, 20));
  const rows = [headerRow, ...dataRows];
  const contacts = rowsToSheetContacts({
    columnMap: mapping.columnMap,
    rows,
    listId,
    sheetId,
    tabName,
    startRow: Number(startRow)
  });
  const { membershipRows, previewContacts } = await upsertImportedContactsAsMemberships({
    contacts,
    contactSourceType: "google_sheets",
    listId,
    sourceName: `Google Sheet: ${sheetId} / ${tabName}`
  });
  return {
    batchSize: safeBatchSize,
    done: dataRows.length < safeBatchSize,
    headers: headerRow,
    imported: membershipRows.length,
    columnMap: mapping.columnMap,
    mappingConfidence: mapping.mappingConfidence,
    mappingMode: mapping.mappingMode,
    mappingNotes: mapping.mappingNotes,
    nextStartRow: Number(startRow) + dataRows.length,
    previewContacts,
    readRows: dataRows.length,
    serviceAccountEmail: serviceAccount.client_email,
    skipped: dataRows.length - membershipRows.length,
    startRow: Number(startRow)
  };
}

async function getConfiguredGoogleServiceAccount() {
  const settings = await scanAll(tables.integrationSettings);
  const googleSheets = settings.find((setting) => setting.settingKey === "googleSheets") || {};
  const secretName = googleSheets.secretName || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_SECRET_NAME;
  if (!secretName) throw new Error("Google Sheets service account secret name is not configured");
  return getGoogleServiceAccount(secretName);
}

async function fetchGoogleSheetRows({ range, sheetId, tabName, token }) {
  const safeTabName = String(tabName).replace(/'/g, "''");
  const encodedRange = encodeURIComponent(`'${safeTabName}'!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodedRange}?majorDimension=ROWS`;
  const result = await fetchJson(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return result.values || [];
}

function rowRange(range = "A:Z", startRow = 1, endRow = startRow) {
  const match = String(range || "A:Z").toUpperCase().match(/^([A-Z]+)(?::([A-Z]+))?$/);
  if (!match) return range;
  const startColumn = match[1];
  const endColumn = match[2] || match[1];
  return `${startColumn}${startRow}:${endColumn}${endRow}`;
}

async function getGoogleServiceAccount(secretName) {
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
  const raw = result.SecretString || Buffer.from(result.SecretBinary || "", "base64").toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) throw new Error("Google service account secret must include client_email and private_key");
  return {
    ...parsed,
    private_key: String(parsed.private_key).replace(/\\n/g, "\n")
  };
}

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }));
  const unsigned = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const result = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  return result.access_token;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  if (!text) return {};
  return JSON.parse(text);
}

function base64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function deleteExistingContactsForList(listId) {
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceContacts,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey,
      Limit: 1000
    }));
    const keys = (result.Items || []).map((item) => ({
      listId: fromAttributeValue(item.listId),
      contactId: fromAttributeValue(item.contactId)
    }));
    await batchDelete(tables.audienceContacts, keys);
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

async function deleteExistingMembershipsForList(listId) {
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName: tables.audienceMemberships,
      KeyConditionExpression: "listId = :listId",
      ExpressionAttributeValues: {
        ":listId": { S: listId }
      },
      ExclusiveStartKey,
      Limit: 1000
    }));
    const keys = (result.Items || []).map((item) => ({
      listId: fromAttributeValue(item.listId),
      contactId: fromAttributeValue(item.contactId)
    }));
    await batchDelete(tables.audienceMemberships, keys);
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

async function batchPut(TableName, items) {
  for (let index = 0; index < items.length; index += 25) {
    const RequestItems = {
      [TableName]: items.slice(index, index + 25).map((item) => ({
        PutRequest: {
          Item: toDynamoItem({ ...item, updatedAt: new Date().toISOString() })
        }
      }))
    };
    await batchWriteAll(RequestItems);
  }
}

async function batchDelete(TableName, keys) {
  for (let index = 0; index < keys.length; index += 25) {
    const RequestItems = {
      [TableName]: keys.slice(index, index + 25).map((key) => ({
        DeleteRequest: {
          Key: toDynamoItem(key)
        }
      }))
    };
    await batchWriteAll(RequestItems);
  }
}

async function batchWriteAll(RequestItems) {
  let pending = RequestItems;
  let attempt = 0;
  do {
    try {
      const result = await dynamo.send(new BatchWriteItemCommand({ RequestItems: pending }));
      pending = result.UnprocessedItems || {};
      if (Object.keys(pending).length) {
        await sleep(Math.min(200 * 2 ** attempt++, 5000));
      }
    } catch (error) {
      if (!isRetryableDynamoError(error) || attempt >= 8) throw error;
      await sleep(Math.min(250 * 2 ** attempt++, 6000));
    }
  } while (Object.keys(pending).length);
}

function isRetryableDynamoError(error) {
  return ["InternalServerError", "ThrottlingException", "ProvisionedThroughputExceededException", "RequestLimitExceeded"].includes(error?.name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodePageToken(key) {
  return key ? Buffer.from(JSON.stringify(key)).toString("base64url") : "";
}

function decodePageToken(token) {
  if (!token) return undefined;
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
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

const contactFields = Object.keys(sheetColumnAliases);

function inferSheetColumnMap(headers = []) {
  const normalized = headers.map(normalizeColumnName);
  return Object.fromEntries(
    Object.entries(sheetColumnAliases).map(([field, aliases]) => [
      field,
      aliases.flatMap((alias) => normalized.map((header, index) => header === alias ? index : -1).filter((index) => index >= 0))
    ]).filter(([, indexes]) => indexes.length)
  );
}

async function buildSheetColumnMap(headers = [], sampleRows = []) {
  const fallbackMap = inferSheetColumnMap(headers);
  if (!headers.length || process.env.DISABLE_BEDROCK_SHEET_MAPPING === "true") {
    return {
      columnMap: fallbackMap,
      mappingMode: "rules",
      mappingConfidence: null,
      mappingNotes: ["AI mapping disabled or no headers were found."]
    };
  }
  try {
    const aiResult = await inferSheetColumnMapWithBedrock(headers, sampleRows);
    const normalizedMap = normalizeSheetColumnMap(aiResult.columnMap, headers);
    return {
      columnMap: mergeSheetColumnMaps(normalizedMap, fallbackMap),
      mappingMode: "bedrock",
      mappingConfidence: aiResult.confidence ?? null,
      mappingNotes: aiResult.notes || []
    };
  } catch (error) {
    console.warn("Bedrock sheet mapping failed, using rules fallback", error);
    return {
      columnMap: fallbackMap,
      mappingMode: "rules_fallback",
      mappingConfidence: null,
      mappingNotes: [error.message || "Bedrock mapping failed."]
    };
  }
}

async function inferSheetColumnMapWithBedrock(headers = [], sampleRows = []) {
  const sample = sampleRows.slice(0, 20).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header || `Column ${index + 1}`, String(row[index] || "").slice(0, 160)]))
  );
  const prompt = [
    "Map a Google Sheet contact export into the Cloudwrxs campaign contact schema.",
    "Return only compact JSON. Do not include markdown.",
    "Use zero-based column indexes. Each field value must be an array of candidate indexes in priority order.",
    "Only include indexes that actually exist in the provided headers.",
    "If a field cannot be mapped, use an empty array.",
    "Schema fields:",
    contactFields.join(", "),
    "JSON shape:",
    "{\"columnMap\":{\"firstName\":[0],\"email\":[4,5]},\"confidence\":0.0,\"notes\":[\"short note\"]}",
    `Headers: ${JSON.stringify(headers)}`,
    `Sample rows: ${JSON.stringify(sample)}`
  ].join("\n");
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 900,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }]
      }
    ]
  };
  const result = await bedrock.send(new InvokeModelCommand({
    modelId: sheetMappingModelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body)
  }));
  const parsed = JSON.parse(new TextDecoder().decode(result.body));
  const text = parsed.content?.map((part) => part.text || "").join("").trim() || "{}";
  return JSON.parse(extractJsonObject(text));
}

function extractJsonObject(value = "") {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Bedrock did not return a JSON object");
  return value.slice(start, end + 1);
}

function normalizeSheetColumnMap(columnMap = {}, headers = []) {
  const maxIndex = headers.length - 1;
  return Object.fromEntries(
    contactFields.map((field) => {
      const rawIndexes = Array.isArray(columnMap[field])
        ? columnMap[field]
        : Number.isInteger(columnMap[field])
          ? [columnMap[field]]
          : [];
      const indexes = Array.from(new Set(rawIndexes.map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index <= maxIndex)));
      return [field, indexes];
    }).filter(([, indexes]) => indexes.length)
  );
}

function mergeSheetColumnMaps(primaryMap = {}, fallbackMap = {}) {
  return Object.fromEntries(
    contactFields.map((field) => {
      const indexes = Array.from(new Set([...(primaryMap[field] || []), ...(fallbackMap[field] || [])]));
      return [field, indexes];
    }).filter(([, indexes]) => indexes.length)
  );
}

function rowsToSheetContacts({ columnMap: providedColumnMap, rows, listId, sheetId, startRow = 2, tabName }) {
  const [headers = [], ...dataRows] = rows;
  const columnMap = providedColumnMap || inferSheetColumnMap(headers);
  return dataRows
    .map((row, index) => {
      const cell = (field) => firstNonEmptyCell(row, columnMap[field]);
      const fullName = cell("fullName");
      const [fallbackFirstName = "", ...fallbackLastName] = fullName.trim().split(/\s+/);
      const rawJobTitle = cell("jobTitle");
      const countryFromTitle = extractCountryFromText(rawJobTitle);
      const country = cell("country") || countryFromTitle;
      const rowNumber = Number(startRow) + index;
      return {
        listId,
        contactId: `sheet-${listId}-${rowNumber}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
        firstName: cell("firstName") || fallbackFirstName,
        lastName: cell("lastName") || fallbackLastName.join(" "),
        email: cell("email").toLowerCase(),
        phone: cell("phone"),
        country,
        technology: cell("technology"),
        persona: cell("persona"),
        jobTitle: cleanJobTitle(rawJobTitle, countryFromTitle),
        lifecycleStage: cell("lifecycleStage"),
        company: cell("company"),
        owner: cell("owner"),
        sourceRowNumber: rowNumber,
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

function placeholderKeys(text = "") {
  return Array.from(text.matchAll(/{{\s*([A-Z0-9_]+)\s*}}/g), (match) => match[1]).filter((key, index, list) => list.indexOf(key) === index);
}

function slugify(value = "item") {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}

function toDynamoItem(item) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toAttributeValue(value)]));
}

function toAttributeValue(value) {
  if (value === null || value === undefined) return { NULL: true };
  if (typeof value === "string") return { S: value };
  if (typeof value === "number") return { N: String(value) };
  if (typeof value === "boolean") return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(toAttributeValue) };
  return {
    M: Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined).map(([key, nested]) => [key, toAttributeValue(nested)]))
  };
}

function fromDynamoItem(item) {
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, fromAttributeValue(value)]));
}

function fromAttributeValue(value) {
  if ("S" in value) return value.S;
  if ("N" in value) return Number(value.N);
  if ("BOOL" in value) return value.BOOL;
  if ("NULL" in value) return null;
  if ("L" in value) return value.L.map(fromAttributeValue);
  if ("M" in value) return Object.fromEntries(Object.entries(value.M).map(([key, nested]) => [key, fromAttributeValue(nested)]));
  return undefined;
}
