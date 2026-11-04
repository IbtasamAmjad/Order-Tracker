export const dynamic = "force-dynamic";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <div className="master-ui mx-auto w-full max-w-md p-4 print:max-w-none print:p-0">{children}</div>;
}
