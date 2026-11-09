import { notFound } from "next/navigation";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import { getWorkflow } from "@/lib/workflows";
import { saveWorkflowAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditWorkflow({ params }: { params: Promise<{ id: string }> }) {
  const w = getWorkflow(Number((await params).id));
  if (!w) notFound();
  return (
    <div className="space-y-5">
      <h1 className="page-title normal-case">{w.name}</h1>
      <WorkflowEditor
        key={`${w.id}-${w.stages.map((s) => s.key).join(",")}`}
        id={w.id}
        initialName={w.name}
        initialSteps={w.stages.map((s) => ({ key: s.key, label: s.label, photo: s.photo }))}
        usedBy={w.usedBy}
        action={saveWorkflowAction}
      />
    </div>
  );
}
