import { PageTitle } from "@/components/ui";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import { saveWorkflowAction } from "../actions";

export default function NewWorkflow() {
  return (
    <div className="space-y-5">
      <PageTitle icon="note">New steps</PageTitle>
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
