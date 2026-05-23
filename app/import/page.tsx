import { JobImportForm } from '@/components/JobImportForm';

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Intake</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Import a job</h1>
        <p className="mt-1 text-sm text-ink/60">
          Paste a URL or the raw job description. AI extracts the fields, stores it, and scores it against your resume.
        </p>
      </div>
      <JobImportForm />
    </div>
  );
}
