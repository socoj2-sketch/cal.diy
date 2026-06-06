import { describe, expect, it } from "vitest";
import {
  buildTenantBookingPath,
  buildTenantEmbedSnippet,
  getDefaultSchedulerTenant,
  getSchedulerTenant,
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
    expect(resolveSchedulerTenantFromHostname("cliniva.ai")?.slug).toBe("cliniva");
    expect(resolveSchedulerTenantFromHostname("scheduler.cliniva.ai")?.slug).toBe("cliniva");
    expect(resolveSchedulerTenantFromHostname("app.businessopsforge.com")?.slug).toBe("business-ops-forge");
    expect(resolveSchedulerTenantFromHostname("scheduler.businessopsforge.com:443")?.slug).toBe(
      "business-ops-forge"
    );
    expect(resolveSchedulerTenantFromHostname("example.com")).toBeNull();
  });

  it("builds team-scoped booking paths instead of user-global paths", () => {
    const cliniva = getSchedulerTenant("cliniva") ?? getDefaultSchedulerTenant();
    const bof = getSchedulerTenant("business-ops-forge") ?? getDefaultSchedulerTenant();

    expect(buildTenantBookingPath(cliniva)).toBe("/team/cliniva-scheduling/patient-consultation");
    expect(buildTenantBookingPath(bof, "implementation-planning")).toBe(
      "/team/business-ops-forge-scheduling/implementation-planning"
    );
  });

  it("builds embed snippets scoped to each tenant namespace", () => {
    const tenant = getSchedulerTenant("cliniva") ?? getDefaultSchedulerTenant();
    const snippet = buildTenantEmbedSnippet({ tenant, schedulerOrigin: "https://scheduler.cliniva.ai/" });

    expect(snippet).toContain('"https://scheduler.cliniva.ai/embed/embed.js"');
    expect(snippet).toContain('Cal("init", "cliniva"');
    expect(snippet).toContain('calLink: "cliniva-scheduling/patient-consultation"');
    expect(snippet).toContain('id="cliniva-scheduler"');
  });
});
