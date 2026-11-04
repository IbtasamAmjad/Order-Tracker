import Link from "next/link";
import { Icon } from "@/components/Icon";
import { btnPrimary } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="mx-auto text-3xl">Order Tracker</h1>
        <hr className="stitch mx-auto my-3 w-24" />
        <p className="page-sub">Custom orders, from first measurement to shipment.</p>
      </div>
      <div className="panel space-y-5 p-6">
        <div>
          <h2 className="text-xl">Admin</h2>
          <Link href="/admin" className={`${btnPrimary} mt-2 w-full`}>
            Open orders
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
        <hr className="stitch" />
        <div>
          <h2 className="text-xl">Masters</h2>
          <p className="mt-1 text-base text-muted">Use the personal link Anas sent you.</p>
        </div>
      </div>
    </main>
  );
}
