import { ServerOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useServerStatusQuery } from "../hooks/queries";
import TabbedCommandBlock from "./TabbedCommandBlock";

export default function ServerOfflineModal() {
  const { data, isError, isLoading, isFetched } = useServerStatusQuery();

  const isFirstTry = isLoading && !isError && !isFetched;
  const isOffline = isError || (isFetched && !data?.ok);

  if (isFirstTry || !isOffline) return null;

  const origin = window.location.origin;

  return (
    <Dialog open={true} modal={true} disablePointerDismissal>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ServerOff size={20} style={{ color: "var(--c-red)" }} />
            <DialogTitle>Beacon server is offline</DialogTitle>
          </div>
          <DialogDescription>
            Start the relay server from your terminal so the viewer can connect.
            Run this command in your learning folder:
          </DialogDescription>
        </DialogHeader>

        <TabbedCommandBlock
          label="With:"
          commands={{
            global: `beacon serve --cors-origin ${origin}`,
            claude: `npx tsx .claude/skills/beacon/beacon.ts serve --cors-origin ${origin}`,
            agents: `npx tsx .agents/skills/beacon/beacon.ts serve --cors-origin ${origin}`,
          }}
        />

        <p
          className="text-xs"
          style={{ color: "var(--c-subtle)", fontFamily: "var(--font-family-ui)" }}
        >
          This will auto-dismiss once the server is connected.
        </p>
      </DialogContent>
    </Dialog>
  );
}
