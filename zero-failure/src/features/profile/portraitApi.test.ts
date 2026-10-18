import { describe, expect, it, vi } from "vitest";
import type { BlocksClient } from "@seliseblocks/client";
import {
  PORTRAIT_ACCEPT,
  PORTRAIT_MAX_BYTES,
  fileUrl,
  portraitError,
  uploadPortrait,
} from "./portraitApi";

// a client with nothing but vi.fn()s — the portrait wire, mocked at
// exactly the seams the real browser client fills: the Data file
// operations, the raw http fallback, and the IAM profile patch
function fakeClient(seams: {
  presigned?: ReturnType<typeof vi.fn>;
  uploadToUrl?: ReturnType<typeof vi.fn>;
  filesGet?: ReturnType<typeof vi.fn>;
  complete?: ReturnType<typeof vi.fn>;
  usersUpdate?: ReturnType<typeof vi.fn>;
}): BlocksClient {
  return {
    data: {
      files: {
        presignedUploadUrl: seams.presigned ?? vi.fn(),
        uploadToUrl: seams.uploadToUrl ?? vi.fn(),
        get: seams.filesGet ?? vi.fn(),
      },
    },
    http: { request: seams.complete ?? vi.fn() },
    iam: { users: { update: seams.usersUpdate ?? vi.fn() } },
  } as unknown as BlocksClient;
}

const FILE = new File(["portrait-bytes"], "me.png", { type: "image/png" });

function presignedAnswer(overrides: Record<string, unknown> = {}) {
  return {
    fileId: "f-1",
    uploadUrl: "https://blob.example/put",
    uploadCompletionRequired: false,
    fileVersionId: "v-1",
    ...overrides,
  };
}

describe("portraitError", () => {
  it("accepts every type the platform uploader accepts", () => {
    expect(PORTRAIT_ACCEPT).toContain("image/png");
    expect(PORTRAIT_ACCEPT).toContain("image/jpeg");
    expect(PORTRAIT_ACCEPT).toContain("image/gif");
    expect(PORTRAIT_ACCEPT).toContain("image/webp");
    expect(PORTRAIT_ACCEPT).toContain("image/svg+xml");
  });

  it("refuses a stranger type before any wire moves", () => {
    expect(portraitError({ type: "application/pdf", size: 10 })).not.toBeNull();
    expect(portraitError({ type: "", size: 10 })).not.toBeNull();
  });

  it("refuses anything over the 5 MB ceiling", () => {
    expect(portraitError({ type: "image/png", size: PORTRAIT_MAX_BYTES + 1 })).not.toBeNull();
  });

  it("lets a right-typed file at the ceiling through", () => {
    expect(portraitError({ type: "image/png", size: PORTRAIT_MAX_BYTES })).toBeNull();
  });
});

describe("fileUrl", () => {
  it("reads the url out of a wrapped record", () => {
    expect(fileUrl({ data: { url: "https://blob.example/see", itemId: "f-1" } })).toBe(
      "https://blob.example/see"
    );
  });

  it("reads the url out of a flat record", () => {
    expect(fileUrl({ url: "https://blob.example/see" })).toBe("https://blob.example/see");
  });

  it("reads an absent url as empty, never a fabricated address", () => {
    expect(fileUrl(undefined)).toBe("");
    expect(fileUrl({ nope: 1 })).toBe("");
  });
});

describe("uploadPortrait", () => {
  it("runs the five steps and binds the picture with the platform's own fields", async () => {
    const presigned = vi.fn().mockResolvedValue(presignedAnswer());
    const uploadToUrl = vi.fn().mockResolvedValue({});
    const filesGet = vi.fn().mockResolvedValue({ url: "https://blob.example/see" });
    const complete = vi.fn();
    const usersUpdate = vi.fn().mockResolvedValue({});
    const client = fakeClient({ presigned, uploadToUrl, filesGet, complete, usersUpdate });

    const result = await uploadPortrait(client, { file: FILE, userId: "u-9" });

    expect(presigned).toHaveBeenCalledWith({
      configurationName: "Default",
      accessModifier: "Public",
      moduleName: 5,
      name: "me.png",
      itemId: "",
      tags: "",
      metaData: "",
      parentDirectoryId: "",
    });
    expect(uploadToUrl).toHaveBeenCalledWith({
      url: "https://blob.example/put",
      body: FILE,
      contentType: "image/png",
    });
    // the presign asked for no completion — the endpoint stays silent
    expect(complete).not.toHaveBeenCalled();
    expect(filesGet).toHaveBeenCalledWith("f-1", { configurationName: "Default" });
    expect(usersUpdate).toHaveBeenCalledWith("u-9", {
      itemId: "u-9",
      profileImageId: "f-1",
      profileImageUrl: "https://blob.example/see",
    });
    expect(result).toEqual({
      fileId: "f-1",
      fileVersionId: "v-1",
      url: "https://blob.example/see",
    });
  });

  it("reads a wrapped presign answer the same as a flat one", async () => {
    const presigned = vi.fn().mockResolvedValue({ data: presignedAnswer() });
    const filesGet = vi.fn().mockResolvedValue({ data: { url: "https://blob.example/see" } });
    const client = fakeClient({ presigned, filesGet });

    const result = await uploadPortrait(client, { file: FILE, userId: "u-9" });

    expect(result.url).toBe("https://blob.example/see");
  });

  it("completes the upload only when the presign demanded it", async () => {
    const complete = vi.fn().mockResolvedValue({});
    const presigned = vi.fn().mockResolvedValue(presignedAnswer({ uploadCompletionRequired: true }));
    const client = fakeClient({ presigned, filesGet: vi.fn().mockResolvedValue({ url: "u" }), complete });

    await uploadPortrait(client, { file: FILE, userId: "u-9" });

    expect(complete).toHaveBeenCalledWith("/data/v4/files/complete-upload", {
      method: "POST",
      body: { fileId: "f-1", fileVersionId: "v-1" },
    });
  });

  it("refuses to move when the presign carries no slot", async () => {
    const presigned = vi.fn().mockResolvedValue({ fileId: "f-1" });
    const uploadToUrl = vi.fn();
    const usersUpdate = vi.fn();
    const client = fakeClient({ presigned, uploadToUrl, usersUpdate });

    await expect(uploadPortrait(client, { file: FILE, userId: "u-9" })).rejects.toThrow();

    expect(uploadToUrl).not.toHaveBeenCalled();
    expect(usersUpdate).not.toHaveBeenCalled();
  });

  it("lets any step's refusal propagate — nothing binds half-uploaded", async () => {
    const usersUpdate = vi.fn().mockRejectedValue(new Error("forbidden"));
    const client = fakeClient({
      presigned: vi.fn().mockResolvedValue(presignedAnswer()),
      filesGet: vi.fn().mockResolvedValue({ url: "https://blob.example/see" }),
      usersUpdate,
    });

    await expect(uploadPortrait(client, { file: FILE, userId: "u-9" })).rejects.toThrow("forbidden");
  });
});
