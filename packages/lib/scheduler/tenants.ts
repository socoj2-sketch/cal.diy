export type SchedulerTenantSlug = "cliniva" | "business-ops-forge";

export type SchedulerTenant = {
  slug: SchedulerTenantSlug;
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

export const schedulerTenants: readonly SchedulerTenant[] = [
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
    bookingHostnames: ["businessopsforge.com", "app.businessopsforge.com", "business-ops-forge.com"],
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

export function getSchedulerTenant(slug: string | null | undefined): SchedulerTenant | null {
  if (!slug) return null;
  return schedulerTenants.find((tenant) => tenant.slug === slug) ?? null;
}

export function resolveSchedulerTenantFromHostname(
  hostname: string | null | undefined
): SchedulerTenant | null {
  if (!hostname) return null;
  const normalizedHostname = hostname.toLowerCase().split(":")[0];
  return (
    schedulerTenants.find((tenant) =>
      tenant.bookingHostnames.some(
        (bookingHostname) =>
          normalizedHostname === bookingHostname || normalizedHostname.endsWith(`.${bookingHostname}`)
      )
    ) ?? null
  );
}

export function getDefaultSchedulerTenant(): SchedulerTenant {
  return schedulerTenants[0];
}

export function buildTenantBookingPath(
  tenant: SchedulerTenant,
  eventTypeSlug: string = tenant.defaultEventTypes[0].slug
): string {
  return `/team/${tenant.teamSlug}/${eventTypeSlug}`;
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
