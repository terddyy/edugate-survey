import { AdminPanel } from "./admin-panel";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl justify-center">
        <AdminPanel />
      </div>
    </main>
  );
}

