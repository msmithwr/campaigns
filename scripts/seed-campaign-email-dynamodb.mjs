import { initialEmailAssignments, initialEmailTemplates, ownerSenderProfiles } from "../src/campaignEmailData.js";
import { execFileSync } from "node:child_process";

const environment = process.env.ENVIRONMENT_NAME || "dev";
const profile = process.env.AWS_PROFILE || "cloudwrxs-mdf";
const region = process.env.AWS_REGION || "us-east-1";
const now = new Date().toISOString();

const tableNames = {
  emails: `CampaignEmails-${environment}`,
  assignments: `CampaignEmailAssignments-${environment}`,
  versions: `CampaignEmailVersions-${environment}`,
  senders: `CampaignSenderProfiles-${environment}`
};

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

function toDynamoItem(item) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toAttributeValue(value)]));
}

async function main() {
  const items = [];

  for (const template of initialEmailTemplates) {
    const placeholders = Array.from(template.bodyText.matchAll(/{{\s*([A-Z0-9_]+)\s*}}/g), (match) => match[1]).filter(
      (key, index, list) => list.indexOf(key) === index
    );
    const item = {
      ...template,
      placeholders,
      updatedAt: template.updatedAt || now
    };
    items.push({ tableName: tableNames.emails, item });
    items.push({
      tableName: tableNames.versions,
      item: {
        emailId: template.emailId,
        version: 1,
        subject: template.subject,
        bodyText: template.bodyText,
        status: template.status,
        editedBy: template.createdBy || "seed",
        editedAt: template.updatedAt || now,
        source: "local-seed"
      }
    });
  }

  for (const assignment of initialEmailAssignments) {
    items.push({
      tableName: tableNames.assignments,
      item: {
        ...assignment,
        updatedAt: now
      }
    });
  }

  for (const profile of Object.values(ownerSenderProfiles)) {
    items.push({
      tableName: tableNames.senders,
      item: {
        active: true,
        ...profile,
        updatedAt: now
      }
    });
  }

  for (const { tableName, item } of items) {
    execFileSync(
      "aws",
      ["dynamodb", "put-item", "--table-name", tableName, "--item", JSON.stringify(toDynamoItem(item)), "--profile", profile, "--region", region],
      { stdio: "pipe" }
    );
  }

  console.log(
    JSON.stringify(
      {
        environment,
        profile,
        region,
        tables: tableNames,
        seeded: {
          emails: initialEmailTemplates.length,
          assignments: initialEmailAssignments.length,
          versions: initialEmailTemplates.length,
          senders: Object.keys(ownerSenderProfiles).length
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
