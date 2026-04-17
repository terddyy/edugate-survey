import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const defaultEmail = "terddy03@gmail.com";
const defaultPassword = "demo123";

const email = process.argv[2] ?? defaultEmail;
const password = process.argv[3] ?? defaultPassword;

const loadEnvFile = (filename) => {
  const filePath = path.join(process.cwd(), filename);

  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  const missing = [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)" : null,
    !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter(Boolean);

  console.error(
    `Missing environment variable(s): ${missing.join(", ")}.`,
  );
  console.error(
    "Add them to .env.local, then rerun: npm run create:admin -- <email> <password>",
  );
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: listedUsers, error: listError } = await adminClient.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listError) {
  console.error("Failed to read existing users:", listError.message);
  process.exit(1);
}

const existing = listedUsers.users.find(
  (user) => user.email?.toLowerCase() === email.toLowerCase(),
);

if (existing) {
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    existing.id,
    {
      password,
      email_confirm: true,
    },
  );

  if (updateError) {
    console.error("Failed to update existing admin user:", updateError.message);
    process.exit(1);
  }

  console.log(`Admin user already exists; password reset for: ${email}`);
} else {
  const { error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    console.error("Failed to create admin user:", createError.message);
    process.exit(1);
  }

  console.log(`Admin user created: ${email}`);
}

const { error: allowlistError } = await adminClient
  .from("admin_users")
  .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

if (allowlistError) {
  console.error(
    "Failed to ensure admin allowlist entry in public.admin_users:",
    allowlistError.message,
  );
  console.error(
    "Run migration/20260417_edugate_survey_v1.sql first, then rerun this script.",
  );
  process.exit(1);
}

console.log(`Admin allowlist confirmed for: ${email.toLowerCase()}`);
