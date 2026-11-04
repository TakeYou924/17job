import { notFound } from "next/navigation";
import ReportPreview from "@/components/report/report-preview";
export const dynamic = "force-dynamic";
export default function Page() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_REPORT_PREVIEW !== "1"
  )
    notFound();
  return <ReportPreview generatedAt={new Date().toISOString()} />;
}
