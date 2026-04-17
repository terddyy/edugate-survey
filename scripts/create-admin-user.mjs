import { createClient } from "@supabase/supabase-js";

const defaultEmail = "terddy03@gmail.com";
const defaultPassword = "demo123";

const email = process.argv[2] ?? defaultEmail;
const password = process.argv[3] ?? defaultPassword;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing environment variables. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
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
  console.log(`Admin user already exists: ${email}`);
  process.exit(0);
}

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

