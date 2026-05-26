export type ReportFormat = "pdf" | "csv" | "json";

export interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  primaryFormat: ReportFormat;
  lastGenerated: string;
}
