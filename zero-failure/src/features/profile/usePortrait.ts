// The portrait's one write, on TanStack Query over the app's single
// blocks client: the five-step upload, then `me` invalidated so the
// dossier re-renders wearing the new face. Nothing else keys off the
// picture — the registry and the consoles are untouched by it.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";
import { accessKeys } from "../access/useAccess";
import { uploadPortrait } from "./portraitApi";

export function usePortraitUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: { file: File; userId: string }) =>
      uploadPortrait(blocksClient, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessKeys.me });
    },
  });
}
