// The access console's query layer: every IAM read and the one write,
// on TanStack Query over the app's single blocks client. The keys live
// in one place because the write invalidates through them — a grant
// refreshes the registry pages, the edited operative's own file, and
// `me` (the dossier's clearance chips) in case the operative edited
// was the operator.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { useCurrentUser } from "../profile/useCurrentUser";
import { blocksClient } from "../../lib/blocks/client";
import {
  assignRolePermissions,
  clearUserAccessOverrides,
  createRole,
  createUser,
  fetchAssignableRoles,
  fetchEmailAvailable,
  fetchPermissions,
  fetchRolePermissions,
  fetchRoles,
  fetchUser,
  fetchUsers,
  updateUserAccess,
  type AccessListQuery,
} from "./consoleApi";

export const accessKeys = {
  users: (page: number, pageSize: number, search: string) =>
    ["iam", "users", page, pageSize, search] as const,
  user: (id: string) => ["iam", "user", id] as const,
  emailAvailable: (email: string) => ["iam", "emailAvailable", email] as const,
  assignableRoles: ["iam", "roles", "assignable"] as const,
  roles: (page: number, pageSize: number, search: string) =>
    ["iam", "roleDefs", page, pageSize, search] as const,
  rolePermissions: (slug: string) => ["iam", "rolePermissions", slug] as const,
  permissions: (page: number, pageSize: number, search: string) =>
    ["iam", "permissions", page, pageSize, search] as const,
  me: ["iam", "me"] as const,
};

/** The shared shape of both console doors: fire the console's own
 *  first read the way the console itself would, and let the server's
 *  answer — not a hardcoded permission name — decide whether the door
 *  renders. The server resolves every grant form (role membership,
 *  direct ids, strings) into the effective set, so its answer is the
 *  tenant's live truth whatever roles exist in it. A refusal (403)
 *  keeps the door shut; false while pending, so the door never
 *  flashes open. */
function useIamReadGate(queryKey: readonly unknown[], probe: () => Promise<unknown>): boolean {
  const { status } = useAuth();
  const me = useCurrentUser();
  const gate = useQuery({
    enabled: status === "authenticated" && me.isSuccess,
    queryFn: probe,
    queryKey,
    staleTime: 60_000,
    retry: false,
  });
  return gate.isSuccess;
}

/** Whether the signed-in operative may open the user registry. */
export function useCanOpenAccess(): boolean {
  return useIamReadGate(accessKeys.users(1, 1, ""), () =>
    fetchUsers(blocksClient, { pageNo: 1, pageSize: 1 })
  );
}

/** Whether the signed-in operative may open the role registry — the
 *  role definitions' own read is the whole test. */
export function useCanManageRoles(): boolean {
  return useIamReadGate(accessKeys.roles(1, 1, ""), () =>
    fetchRoles(blocksClient, { pageNo: 1, pageSize: 1 })
  );
}

export function useAccessUsers(query: AccessListQuery) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => fetchUsers(blocksClient, query),
    queryKey: accessKeys.users(query.pageNo, query.pageSize, query.search ?? ""),
  });
}

export function useAccessUser(userId: string | null) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated" && Boolean(userId),
    queryFn: () => fetchUser(blocksClient, userId as string),
    queryKey: accessKeys.user(userId ?? ""),
  });
}

/** The duplicate-address check the invite form runs live — a courtesy
 *  read, not the gate; the server still refuses the create itself on
 *  a collision. Silent until the address even looks like one. */
export function useEmailAvailable(email: string) {
  const { status } = useAuth();
  const plausible = /^\S+@\S+\.\S+$/.test(email);
  return useQuery({
    enabled: status === "authenticated" && plausible,
    queryFn: () => fetchEmailAvailable(blocksClient, email),
    queryKey: accessKeys.emailAvailable(email),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAssignableRoles() {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => fetchAssignableRoles(blocksClient),
    queryKey: accessKeys.assignableRoles,
    staleTime: 60_000,
  });
}

export function useAccessRoles(query: AccessListQuery) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => fetchRoles(blocksClient, query),
    queryKey: accessKeys.roles(query.pageNo, query.pageSize, query.search ?? ""),
  });
}

/** One role's complete held-permission set — the editor's checkmark
 *  source. Fetched whole (paged through in the wire layer) so a
 *  catalog search can never hide a grant the role already holds. */
export function useRolePermissions(slug: string | null) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated" && Boolean(slug),
    queryFn: () => fetchRolePermissions(blocksClient, slug as string),
    queryKey: accessKeys.rolePermissions(slug ?? ""),
  });
}

export function useAccessPermissions(query: AccessListQuery) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => fetchPermissions(blocksClient, query),
    queryKey: accessKeys.permissions(query.pageNo, query.pageSize, query.search ?? ""),
  });
}

export function useUpdateUserAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: { userId: string; roles: string[]; permissions: string[] }) =>
      // a desired set that bottoms out empty needs the revoke-and-regrant
      // transmission — the plain write would keep the last grant (an
      // empty list reads as "leave unchanged" on the gateway)
      request.roles.length === 0 || request.permissions.length === 0
        ? clearUserAccessOverrides(blocksClient, request)
        : updateUserAccess(blocksClient, request),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["iam", "user", variables.userId] });
      void queryClient.invalidateQueries({ queryKey: accessKeys.me });
    },
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: { name: string; slug?: string; description?: string }) =>
      createRole(blocksClient, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["iam", "roleDefs"] });
      void queryClient.invalidateQueries({ queryKey: ["iam", "roles"] });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: {
      email: string;
      firstName?: string;
      lastName?: string;
      password?: string;
      roles?: string[];
    }) => createUser(blocksClient, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
    },
  });
}

export function useAssignRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: { slug: string; addPermissions: string[]; removePermissions: string[] }) =>
      assignRolePermissions(blocksClient, request),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["iam", "roleDefs"] });
      void queryClient.invalidateQueries({ queryKey: ["iam", "rolePermissions", variables.slug] });
      void queryClient.invalidateQueries({ queryKey: ["iam", "permissions"] });
    },
  });
}
