import { WorkflowEditor } from "@/components/WorkflowEditor";
import { saveWorkflowAction } from "../actions";

export default function NewWorkflow() {
  return (
    <div className="space-y-5">
      <h1 className="page-title">New workflow</h1>
      <WorkflowEditor
        initialName=""
        initialSteps={[
          { key: "", label: "", photo: "optional" },
          { key: "", label: "", photo: "optional" },
        ]}
        usedBy={[]}
        action={saveWorkflowAction}
      />
    </div>
  );
}
