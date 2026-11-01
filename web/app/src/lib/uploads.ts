export type UploadStatus = "uploading" | "done" | "error";

export interface UploadTask {
  id: string;
  filename: string;
  status: UploadStatus;
  detail?: string;
  error?: string;
}
