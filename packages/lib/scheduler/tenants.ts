type SchedulerTenant = {
  slug: string;
  displayName: string;
  organizationSlug: string;
  teamSlug: string;
  adminEmail: string;
  adminUsername: string;
  autoAcceptEmailDomain: string;
  bookingHostnames: string[];
  brandColor: string;
  darkBrandColor: string;
  defaultEventTypes: {
    slug: string;
    title: string;
    description: string;
    length: number;
  }[];
};

const defaultSchedulerTenants: readonly SchedulerTenant[] = [
  {
    slug: "cliniva",
    displayName: "Cliniva",
    organizationSlug: "cliniva",
    teamSlug: "cliniva-scheduling",
    adminEmail: "scheduler-admin@clinivaai.com",
    adminUsername: "cliniva-scheduler-admin",
    autoAcceptEmailDomain: "clinivaai.com",
    bookingHostnames: ["clinivaai.com", "www.clinivaai.com", "scheduler.clinivaai.com"],
    brandColor: "#2563eb",
    darkBrandColor: "#60a5fa",
    defaultEventTypes: [
      {
        slug: "patient-consultation",
        title: "Patient consultation",
        description: "Cliniva patient appointment request routed to the clinic scheduling team.",
        length: 30,
      },
      {
        slug: "clinic-onboarding",
        title: "Clinic onboarding",
        description: "Operational onboarding session for a Cliniva clinic workspace.",
        length: 45,
      },
    ],
  },
  {
    slug: "business-ops-forge",
    displayName: "Business Ops Forge",
    organizationSlug: "business-ops-forge",
    teamSlug: "business-ops-forge-scheduling",
    adminEmail: "scheduler-admin@businessopsforge.com",
    adminUsername: "bof-scheduler-admin",
    autoAcceptEmailDomain: "businessopsforge.com",
    bookingHostnames: [
      "businessopsforge.com",
      "app.businessopsforge.com",
      "business-ops-forge.com",
      "scheduler.businessopsforge.com",
    ],
    brandColor: "#f97316",
    darkBrandColor: "#fb923c",
    defaultEventTypes: [
      {
        slug: "ops-consultation",
        title: "Operations consultation",
        description: "Business Ops Forge consultation routed to the operations scheduling team.",
        length: 30,
      },
      {
        slug: "implementation-planning",
        title: "Implementation planning",
        description: "Planning session for portal, automation, or customer operations rollout.",
        length: 45,
      },
    ],
  },
];

export const schedulerTenants: readonly SchedulerTenant[] = defaultSchedulerTenants;

function isSchedulerTenant(value: unknown): value is SchedulerTenant {
  if (!value || typeof value !== "object") return false;

  const tenant = value as Record<string, unknown>;
  return (
    typeof tenant.slug === "string" &&
    typeof tenant.displayName === "string" &&
    typeof tenant.organizationSlug === "string" &&
    typeof tenant.teamSlug === "string" &&
    typeof tenant.adminEmail === "string" &&
    typeof tenant.adminUsername === "string" &&
    typeof tenant.autoAcceptEmailDomain === "string" &&
    Array.isArray(tenant.bookingHostnames) &&
    tenant.bookingHostnames.every((hostname) => typeof hostname === "string") &&
    typeof tenant.brandColor === "string" &&
    typeof tenant.darkBrandColor === "string" &&
    Array.isArray(tenant.defaultEventTypes) &&
    tenant.defaultEventTypes.length > 0 &&
    tenant.defaultEventTypes.every((eventType) => {
      if (!eventType || typeof eventType !== "object") return false;
      const typedEventType = eventType as Record<string, unknown>;
      return (
        typeof typedEventType.slug === "string" &&
        typeof typedEventType.title === "string" &&
        typeof typedEventType.description === "string" &&
        typeof typedEventType.length === "number"
      );
    })
  );
}

export function parseSchedulerTenantsJson(
  tenantsJson: string | null | undefined
): readonly SchedulerTenant[] {
  if (!tenantsJson) return schedulerTenants;

  const parsedTenants = JSON.parse(tenantsJson) as unknown;
  if (!Array.isArray(parsedTenants) || parsedTenants.length === 0) {
    throw new Error("SCHEDULER_TENANTS_JSON must be a non-empty array of scheduler tenant objects.");
  }

  const invalidTenantIndex = parsedTenants.findIndex((tenant) => !isSchedulerTenant(tenant));
  if (invalidTenantIndex >= 0) {
    throw new Error(
      `SCHEDULER_TENANTS_JSON tenant at index ${invalidTenantIndex} is missing required fields.`
    );
  }

  const tenantSlugs = new Set<string>();
  const organizationSlugs = new Set<string>();
  const teamSlugs = new Set<string>();

  for (const tenant of parsedTenants) {
    if (tenantSlugs.has(tenant.slug)) throw new Error(`Duplicate scheduler tenant slug: ${tenant.slug}`);
    if (organizationSlugs.has(tenant.organizationSlug)) {
      throw new Error(`Duplicate scheduler organization slug: ${tenant.organizationSlug}`);
    }
    if (teamSlugs.has(tenant.teamSlug)) throw new Error(`Duplicate scheduler team slug: ${tenant.teamSlug}`);

    tenantSlugs.add(tenant.slug);
    organizationSlugs.add(tenant.organizationSlug);
    teamSlugs.add(tenant.teamSlug);
  }

  return parsedTenants;
}

export function getSchedulerTenant(
  slug: string | null | undefined,
  tenants: readonly SchedulerTenant[] = schedulerTenants
): SchedulerTenant | null {
  if (!slug) return null;
  return tenants.find((tenant) => tenant.slug === slug) ?? null;
}

function hostnameMatchesPattern(hostname: string, pattern: string): boolean {
  const normalizedPattern = pattern.toLowerCase().split(":")[0];
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return hostname.endsWith(`.${suffix}`) && hostname !== suffix;
  }

  return hostname === normalizedPattern || hostname.endsWith(`.${normalizedPattern}`);
}

export function resolveSchedulerTenantFromHostname(
  hostname: string | null | undefined,
  tenants: readonly SchedulerTenant[] = schedulerTenants
): SchedulerTenant | null {
  if (!hostname) return null;
  const normalizedHostname = hostname.toLowerCase().split(":")[0];
  return (
    tenants.find((tenant) =>
      tenant.bookingHostnames.some((bookingHostname) =>
        hostnameMatchesPattern(normalizedHostname, bookingHostname)
      )
    ) ?? null
  );
}

export function getDefaultSchedulerTenant(
  tenants: readonly SchedulerTenant[] = schedulerTenants
): SchedulerTenant {
  return tenants[0];
}

export function buildTenantBookingPath(
  tenant: SchedulerTenant,
  eventTypeSlug: string = tenant.defaultEventTypes[0].slug
): string {
  return `/${tenant.teamSlug}/${eventTypeSlug}`;
}

export function buildTenantEmbedSnippet({
  tenant,
  schedulerOrigin,
  eventTypeSlug = tenant.defaultEventTypes[0].slug,
}: {
  tenant: SchedulerTenant;
  schedulerOrigin: string;
  eventTypeSlug?: string;
}): string {
  const origin = schedulerOrigin.replace(/\/$/, "");
  const calLink = `${tenant.teamSlug}/${eventTypeSlug}`;

  return `<script>\n  (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "${origin}/embed/embed.js", "init");\n  Cal("init", "${tenant.slug}", { origin: "${origin}" });\n  Cal.ns["${tenant.slug}"]("inline", { elementOrSelector: "#${tenant.slug}-scheduler", calLink: "${calLink}" });\n</script>\n<div id="${tenant.slug}-scheduler" style="width:100%;height:720px;overflow:scroll"></div>`;
}

export type { SchedulerTenant };
