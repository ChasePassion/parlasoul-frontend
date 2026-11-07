"use client";

import { useEffect, useState } from "react";

import CharacterForgeWorkspace from "@/components/CharacterForgeWorkspace";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import { useSidebar } from "../layout";

export default function CreateCharacterPage() {
  const { setSelectedCharacterId, toggleSidebar } = useSidebar();
  const [isManualCreateOpen, setManualCreateOpen] = useState(false);

  useEffect(() => {
    setSelectedCharacterId(null);
  }, [setSelectedCharacterId]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CharacterForgeWorkspace
        onManualCreate={() => setManualCreateOpen(true)}
        onToggleSidebar={toggleSidebar}
      />
      <CreateCharacterModal
        isOpen={isManualCreateOpen}
        onClose={() => setManualCreateOpen(false)}
        onSuccess={() => setManualCreateOpen(false)}
        mode="create"
      />
    </div>
  );
}
