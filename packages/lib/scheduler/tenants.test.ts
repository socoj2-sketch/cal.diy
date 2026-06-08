import { describe, expect, it } from "vitest";
import {
  buildTenantBookingPath,
  buildTenantEmbedSnippet,
  getDefaultSchedulerTenant,
  getSchedulerTenant,
  parseSchedulerTenantsJson,
  resolveSchedulerTenantFromHostname,
  schedulerTenants,
} from "./tenants";

describe("scheduler tenant configuration", () => {
  it("defines isolated Cliniva and Business Ops Forge tenants", () => {
    expect(schedulerTenants.map((tenant) => tenant.slug)).toEqual(["cliniva", "business-ops-forge"]);
    expect(new Set(schedulerTenants.map((tenant) => tenant.organizationSlug)).size).toBe(2);
    expect(new Set(schedulerTenants.map((tenant) => tenant.teamSlug)).size).toBe(2);
  });

  it("resolves tenant from first-party hostnames and subdomains", () => {
    expect(resolveSchedulerTenantFromHostname("clinivaai.com")?.slug).toBe("cliniva");
    expect(resolveSchedulerTenantFromHostname("scheduler.clinivaai.com")?.slug).toBe("cliniva");
    expect(resolveSchedulerTenantFromHostname("app.businessopsforge.com")?.slug).toBe("business-ops-forge");
    expect(resolveSchedulerTenantFromHostname("scheduler.businessopsforge.com:443")?.slug).toBe(
      "business-ops-forge"
    );
    expect(resolveSchedulerTenantFromHostname("example.com")).toBeNull();
  });

  it("loads many customer tenants from runtime JSON instead of source-code changes", () => {
    const tenants = parseSchedulerTenantsJson(
      JSON.stringify([
        {
          slug: "customer-acme",
          displayName: "Acme Health",
          organizationSlug: "customer-acme",
          teamSlug: "customer-acme-scheduling",
          adminEmail: "scheduler-admin@acme.example",
          adminUsername: "customer-acme-scheduler-admin",
          autoAcceptEmailDomain: "acme.example",
          bookingHostnames: ["acme.example", "acme.scheduler.clinivaai.com", "*.acme.example"],
          brandColor: "#0f766e",
          darkBrandColor: "#2dd4bf",
          defaultEventTypes: [
            {
              slug: "consultation",
              title: "Consultation",
              description: "Customer-scoped consultation.",
              length: 30,
            },
          ],
        },
      ])
    );

    expect(getSchedulerTenant("customer-acme", tenants)?.displayName).toBe("Acme Health");
    expect(resolveSchedulerTenantFromHostname("east.acme.example", tenants)?.slug).toBe("customer-acme");
    expect(buildTenantBookingPath(getDefaultSchedulerTenant(tenants))).toBe(
      "/customer-acme-scheduling/consultation"
    );
  });

  it("rejects duplicate runtime tenant slugs and team slugs", () => {
    const tenant = schedulerTenants[0];
    expect(() => parseSchedulerTenantsJson(JSON.stringify([tenant, tenant]))).toThrow(
      "Duplicate scheduler tenant slug: cliniva"
    );
  });

  it("builds team-scoped booking paths instead of user-global paths", () => {
    const cliniva = getSchedulerTenant("cliniva") ?? getDefaultSchedulerTenant();
    const bof = getSchedulerTenant("business-ops-forge") ?? getDefaultSchedulerTenant();

    expect(cliniva.defaultEventTypes).toHaveLength(1);
    expect(cliniva.defaultEventTypes[0]).toMatchObject({
      slug: "workflow-review",
      title: "Schedule your workflow review today.",
      length: 30,
    });
    expect(cliniva.retiredEventTypeSlugs).toEqual(["patient-consultation", "clinic-onboarding"]);
    expect(buildTenantBookingPath(cliniva)).toBe("/cliniva-scheduling/workflow-review");
    expect(bof.defaultEventTypes).toHaveLength(1);
    expect(bof.defaultEventTypes[0]).toMatchObject({
      slug: "workflow-audit",
      title: "Schedule your workflow audit today.",
      length: 30,
    });
    expect(bof.retiredEventTypeSlugs).toEqual(["ops-consultation", "implementation-planning"]);
    expect(buildTenantBookingPath(bof)).toBe("/business-ops-forge-scheduling/workflow-audit");
  });

  it("builds embed snippets scoped to each tenant namespace", () => {
    const tenant = getSchedulerTenant("cliniva") ?? getDefaultSchedulerTenant();
    const snippet = buildTenantEmbedSnippet({ tenant, schedulerOrigin: "https://scheduler.clinivaai.com/" });

    expect(snippet).toContain('"https://scheduler.clinivaai.com/embed/embed.js"');
    expect(snippet).toContain('Cal("init", "cliniva"');
    expect(snippet).toContain('calLink: "cliniva-scheduling/workflow-review"');
    expect(snippet).toContain('id="cliniva-scheduler"');
  });
});
