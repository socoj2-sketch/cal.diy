import process from "node:process";
import { hashPassword } from "@calcom/lib/auth/hashPassword";
import { DEFAULT_SCHEDULE, getAvailabilityFromSchedule } from "@calcom/lib/availability";
import { parseSchedulerTenantsJson } from "@calcom/lib/scheduler/tenants";
import { prisma } from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { MembershipRole, SchedulingType } from "@calcom/prisma/enums";

type SchedulerTenantConfig = ReturnType<typeof parseSchedulerTenantsJson>[number];
type SeededAdmin = {
  id: number;
  email: string;
  username: string | null;
  schedules: { id: number }[];
};

function getBootstrapPassword(tenantSlug: string): string {
  const envKey = `${tenantSlug.toUpperCase().replace(/-/g, "_")}_CAL_ADMIN_PASSWORD`;
  const password = process.env[envKey] ?? process.env.CAL_TENANT_BOOTSTRAP_PASSWORD;

  if (!password) {
    throw new Error(`Set ${envKey} or CAL_TENANT_BOOTSTRAP_PASSWORD before seeding scheduler tenants.`);
  }

  return password;
}

async function upsertTenantAdmin({
  tenant,
  password,
}: {
  tenant: SchedulerTenantConfig;
  password: string;
}): Promise<SeededAdmin> {
  const user = await prisma.user.upsert({
    where: {
      email_username: {
        email: tenant.adminEmail,
        username: tenant.adminUsername,
      },
    },
    update: {
      name: `${tenant.displayName} Scheduler Admin`,
      completedOnboarding: true,
      emailVerified: new Date(),
      locale: "en",
      timeZone: "America/New_York",
    },
    create: {
      email: tenant.adminEmail,
      username: tenant.adminUsername,
      name: `${tenant.displayName} Scheduler Admin`,
      completedOnboarding: true,
      emailVerified: new Date(),
      locale: "en",
      timeZone: "America/New_York",
      schedules: {
        create: {
          name: `${tenant.displayName} Working Hours`,
          availability: {
            createMany: {
              data: getAvailabilityFromSchedule(DEFAULT_SCHEDULE),
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
      schedules: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  await prisma.userPassword.upsert({
    where: { userId: user.id },
    update: { hash: await hashPassword(password) },
    create: {
      hash: await hashPassword(password),
      user: { connect: { id: user.id } },
    },
  });

  return user;
}

async function upsertMembership({
  teamId,
  userId,
}: {
  teamId: number;
  userId: number;
}): Promise<{ id: number }> {
  return prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
    update: {
      accepted: true,
      role: MembershipRole.OWNER,
    },
    create: {
      userId,
      teamId,
      accepted: true,
      role: MembershipRole.OWNER,
    },
    select: {
      id: true,
    },
  });
}

async function upsertSchedulerTenant(tenant: SchedulerTenantConfig): Promise<void> {
  const password = getBootstrapPassword(tenant.slug);
  const admin = await upsertTenantAdmin({ tenant, password });

  const organizationMetadata = {
    requestedSlug: tenant.organizationSlug,
    schedulerTenant: tenant.slug,
  } satisfies Prisma.InputJsonObject;

  const organization = await prisma.team.upsert({
    where: {
      slug_parentId: {
        slug: tenant.organizationSlug,
        parentId: null,
      },
    },
    update: {
      name: tenant.displayName,
      isOrganization: true,
      isPlatform: false,
      brandColor: tenant.brandColor,
      darkBrandColor: tenant.darkBrandColor,
      metadata: organizationMetadata,
    },
    create: {
      name: tenant.displayName,
      slug: tenant.organizationSlug,
      isOrganization: true,
      isPlatform: false,
      brandColor: tenant.brandColor,
      darkBrandColor: tenant.darkBrandColor,
      metadata: organizationMetadata,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: organization.id },
    update: {
      orgAutoAcceptEmail: tenant.autoAcceptEmailDomain,
      isOrganizationConfigured: true,
      isOrganizationVerified: true,
      isAdminReviewed: true,
      orgAutoJoinOnSignup: true,
      allowSEOIndexing: false,
    },
    create: {
      organizationId: organization.id,
      orgAutoAcceptEmail: tenant.autoAcceptEmailDomain,
      isOrganizationConfigured: true,
      isOrganizationVerified: true,
      isAdminReviewed: true,
      orgAutoJoinOnSignup: true,
      allowSEOIndexing: false,
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { organizationId: organization.id },
  });

  await prisma.profile.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: organization.id,
      },
    },
    update: {
      username: tenant.adminUsername,
    },
    create: {
      uid: `${tenant.slug}-${admin.id}`,
      userId: admin.id,
      organizationId: organization.id,
      username: tenant.adminUsername,
    },
  });

  await upsertMembership({ teamId: organization.id, userId: admin.id });

  const teamMetadata = {
    requestedSlug: tenant.teamSlug,
    schedulerTenant: tenant.slug,
  } satisfies Prisma.InputJsonObject;

  const team = await prisma.team.upsert({
    where: {
      slug_parentId: {
        slug: tenant.teamSlug,
        parentId: organization.id,
      },
    },
    update: {
      name: `${tenant.displayName} Scheduling`,
      brandColor: tenant.brandColor,
      darkBrandColor: tenant.darkBrandColor,
      parentId: organization.id,
      metadata: teamMetadata,
    },
    create: {
      name: `${tenant.displayName} Scheduling`,
      slug: tenant.teamSlug,
      parentId: organization.id,
      brandColor: tenant.brandColor,
      darkBrandColor: tenant.darkBrandColor,
      metadata: teamMetadata,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  const membership = await upsertMembership({ teamId: team.id, userId: admin.id });
  const scheduleId = admin.schedules[0]?.id;

  for (const eventType of tenant.defaultEventTypes) {
    const schedulerMetadata = {
      schedulerTenant: tenant.slug,
      embedHostnames: tenant.bookingHostnames,
    } satisfies Prisma.InputJsonObject;

    const seededEventType = await prisma.eventType.upsert({
      where: {
        teamId_slug: {
          teamId: team.id,
          slug: eventType.slug,
        },
      },
      update: {
        title: eventType.title,
        description: eventType.description,
        length: eventType.length,
        schedulingType: SchedulingType.COLLECTIVE,
        teamId: team.id,
        metadata: schedulerMetadata,
        hidden: false,
      },
      create: {
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description,
        length: eventType.length,
        schedulingType: SchedulingType.COLLECTIVE,
        teamId: team.id,
        metadata: schedulerMetadata,
        hidden: false,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    await prisma.host.upsert({
      where: {
        userId_eventTypeId: {
          userId: admin.id,
          eventTypeId: seededEventType.id,
        },
      },
      update: {
        isFixed: true,
        scheduleId,
        memberId: membership.id,
      },
      create: {
        userId: admin.id,
        eventTypeId: seededEventType.id,
        isFixed: true,
        scheduleId,
        memberId: membership.id,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        tenant: tenant.slug,
        organization: organization.slug,
        team: team.slug,
        admin: admin.email,
        eventTypes: tenant.defaultEventTypes.map(
          (eventType: SchedulerTenantConfig["defaultEventTypes"][number]) =>
            `/team/${team.slug}/${eventType.slug}`
        ),
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const tenants = parseSchedulerTenantsJson(process.env.SCHEDULER_TENANTS_JSON);

  for (const tenant of tenants) {
    await upsertSchedulerTenant(tenant);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
