import LoginForm from "@/app/login/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/write") ? params.next : "/";
  return <div className="page-shell grid min-h-[78vh] items-center py-10 md:grid-cols-[1fr_1fr] md:gap-16">
    <aside className="mb-9 border-l-[7px] border-[var(--accent)] bg-[var(--accent-soft)] px-6 py-7 sm:px-9 sm:py-10 md:mb-0">
      <p className="eyebrow">Good places. Good stories.</p><h1 className="serif mt-3 max-w-md text-4xl leading-tight sm:text-5xl">Keep the memories. Share the details.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-[var(--muted)]">Your thoughtful notes can make somebody else’s next stop feel a little more certain.</p>
    </aside>
    <section className="mx-auto w-full max-w-md"><p className="eyebrow">A seat saved for you</p><h2 className="serif mt-2 text-3xl">Welcome in.</h2><LoginForm nextPath={nextPath} /></section>
  </div>;
}