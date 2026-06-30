import { execFileSync } from "node:child_process";
import { campaigns } from "../src/generated/campaignData.js";

const environment = process.env.ENVIRONMENT_NAME || "dev";
const profile = process.env.AWS_PROFILE || "cloudwrxs-mdf";
const region = process.env.AWS_REGION || "us-east-1";
const now = new Date().toISOString();

const tableNames = {
  campaigns: `Campaigns-${environment}`,
  activities: `CampaignActivities-${environment}`
};

const monthOrder = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
const monthStart = Object.fromEntries(monthOrder.map((month, index) => [month, `2026-${String(index + 1).padStart(2, "0")}-01T00:00:00`]));

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
    weeks.push({
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

function plannedDateForEvent(event, indexInWeek) {
  const month = event.month || monthOrder[0];
  const weekIndex = Math.max(0, Number(event.week.match(/\d+/)?.[0] || 1) - 1);
  const week = getMonthWeeks(month)[weekIndex];
  const availableDays = Math.max(1, 7 - (week?.offset || 0));
  const dayIndex = weekIndex === 0 ? (week?.offset || 0) + (indexInWeek % availableDays) : indexInWeek % 7;
  const dayNumber = week?.days[dayIndex] || week?.days.find(Boolean) || 1;
  const monthDate = new Date(monthStart[month] || monthStart[monthOrder[0]]);
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
}

function statusForEvent(event) {
  const monthIndex = Math.max(0, monthOrder.indexOf(event.month));
  const weekIndex = Math.max(0, Number(event.week.match(/\d+/)?.[0] || 1) - 1);
  const isDone = monthIndex < 3 || (monthIndex === 3 && weekIndex < 3);
  const isPaused = event.type === "email" && monthIndex === 3 && weekIndex === 2;
  return isPaused ? "paused" : isDone ? "complete" : monthIndex === 3 ? "wip" : "queued";
}

function putItem(tableName, item) {
  execFileSync(
    "aws",
    ["dynamodb", "put-item", "--table-name", tableName, "--item", JSON.stringify(toDynamoItem(item)), "--profile", profile, "--region", region],
    { stdio: "pipe" }
  );
}

async function main() {
  let activityCount = 0;

  for (const campaign of campaigns) {
    const weekCounters = {};
    const activities = campaign.events.map((event, sortOrder) => {
      const counterKey = `${event.month}:${event.week}`;
      const indexInWeek = weekCounters[counterKey] || 0;
      weekCounters[counterKey] = indexInWeek + 1;
      const plannedDate = plannedDateForEvent(event, indexInWeek);
      return {
        campaignId: campaign.id,
        activityId: event.id,
        plannedDate: dateToInputValue(plannedDate),
        status: statusForEvent(event),
        sortOrder,
        type: event.type,
        label: event.label || "",
        title: event.title,
        section: event.section,
        sourceMonth: event.month,
        sourceWeek: event.week,
        updatedAt: now
      };
    });
    const dates = activities.map((activity) => activity.plannedDate).sort();
    const { events, ...campaignSetup } = campaign;

    putItem(tableNames.campaigns, {
      ...campaignSetup,
      campaignId: campaign.id,
      status: "active",
      startDate: dates[0] || "2026-01-01",
      endDate: dates.at(-1) || dates[0] || "2026-01-01",
      updatedAt: now
    });

    for (const activity of activities) {
      putItem(tableNames.activities, activity);
      activityCount += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        environment,
        profile,
        region,
        tables: tableNames,
        seeded: {
          campaigns: campaigns.length,
          activities: activityCount
        }
      },
      null,
      2
    )
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
