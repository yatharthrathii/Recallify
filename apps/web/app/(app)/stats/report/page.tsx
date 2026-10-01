import type { Metadata } from 'next';
import { ReportView } from '@/components/report/report-view';

export const metadata: Metadata = { title: 'Memory Report' };

export default function ReportPage() {
  return <ReportView />;
}
