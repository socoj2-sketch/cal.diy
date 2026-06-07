# Cliniva and Business Ops Forge scheduler tenancy

This fork keeps one Cal.diy runtime and separates customer-facing schedulers by organization/team tenant:

- Cliniva organization: `cliniva`
  - Scheduling team: `cliniva-scheduling`
  - Default booking links:
    - `/team/cliniva-scheduling/patient-consultation`
    - `/team/cliniva-scheduling/clinic-onboarding`
- Business Ops Forge organization: `business-ops-forge`
  - Scheduling team: `business-ops-forge-scheduling`
  - Default booking links:
    - `/team/business-ops-forge-scheduling/ops-consultation`
    - `/team/business-ops-forge-scheduling/implementation-planning`

Tenant configuration lives in `packages/lib/scheduler/tenants.ts`. It is intentionally source-controlled and non-secret: slugs, brand colors, hostnames, default event-type contracts, and embed-snippet generation. Runtime secrets remain environment/provider-managed.

## Bootstrap

Set a bootstrap password through the environment before running the seed. The password is hashed into Cal.diy; do not commit or print it.

```bash
export CAL_TENANT_BOOTSTRAP_PASSWORD="..."
yarn ts-node --transpile-only scripts/seed-cliniva-bof-tenants.ts
```

You can override per tenant instead:

```bash
export CLINIVA_CAL_ADMIN_PASSWORD="..."
export BUSINESS_OPS_FORGE_CAL_ADMIN_PASSWORD="..."
yarn ts-node --transpile-only scripts/seed-cliniva-bof-tenants.ts
```

The seed is idempotent. Re-running it updates tenant names, organization settings, brand colors, memberships, hosts, and event-type metadata without duplicating tenants.

## Website embedding

Use `buildTenantEmbedSnippet` from `@calcom/lib/scheduler/tenants` to generate a namespace-scoped embed snippet for each site.

Cliniva example:

```ts
import { buildTenantEmbedSnippet, getSchedulerTenant } from "@calcom/lib/scheduler/tenants";

const tenant = getSchedulerTenant("cliniva");
if (!tenant) throw new Error("Cliniva scheduler tenant missing");

const html = buildTenantEmbedSnippet({
  tenant,
  schedulerOrigin: "https://scheduler.clinivaai.com",
});
```

Business Ops Forge example:

```ts
import { buildTenantEmbedSnippet, getSchedulerTenant } from "@calcom/lib/scheduler/tenants";

const tenant = getSchedulerTenant("business-ops-forge");
if (!tenant) throw new Error("Business Ops Forge scheduler tenant missing");

const html = buildTenantEmbedSnippet({
  tenant,
  schedulerOrigin: "https://scheduler.businessopsforge.com",
});
```

## Deployment notes

- Run one Cal.diy service with PostgreSQL.
- Map scheduler hostnames such as `scheduler.clinivaai.com` and `scheduler.businessopsforge.com` to the same runtime.
- Keep Cliniva and Business Ops Forge as separate Cal.diy organizations/teams so memberships, event types, webhooks, brand colors, API keys, and future calendar credentials stay tenant-scoped.
- Do not create a separate runtime per brand unless compliance/isolation later requires it.
