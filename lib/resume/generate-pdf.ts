import PDFDocument from 'pdfkit';
import { ResumeSections } from '@/lib/ai/prompts';

export function renderResumePdf(resume: ResumeSections): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const header = resume.header || {};
    if (header.name) {
      doc.fontSize(20).font('Helvetica-Bold').text(header.name, { align: 'center' });
    }
    const contact = [header.email, header.phone, header.location, ...(header.links || [])]
      .filter(Boolean)
      .join(' · ');
    if (contact) doc.fontSize(10).font('Helvetica').text(contact, { align: 'center' });

    function sectionHeading(t: string) {
      doc.moveDown(0.7);
      doc.fontSize(12).font('Helvetica-Bold').text(t.toUpperCase());
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#999').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
    }

    if (resume.summary) {
      sectionHeading('Summary');
      doc.text(resume.summary);
    }

    if (resume.experience?.length) {
      sectionHeading('Experience');
      for (const e of resume.experience) {
        doc.font('Helvetica-Bold').text(`${e.title} — ${e.company}${e.location ? ', ' + e.location : ''}`);
        const range = [e.start, e.end].filter(Boolean).join(' – ');
        if (range) doc.font('Helvetica-Oblique').text(range);
        doc.font('Helvetica');
        for (const b of e.bullets || []) doc.text('• ' + b, { indent: 12 });
        doc.moveDown(0.3);
      }
    }

    if (resume.projects?.length) {
      sectionHeading('Projects');
      for (const p of resume.projects) {
        doc.font('Helvetica-Bold').text(p.name);
        doc.font('Helvetica');
        if (p.description) doc.text(p.description);
        for (const b of p.bullets || []) doc.text('• ' + b, { indent: 12 });
        doc.moveDown(0.3);
      }
    }

    if (resume.education?.length) {
      sectionHeading('Education');
      for (const ed of resume.education) {
        doc.font('Helvetica-Bold').text(`${ed.school}${ed.degree ? ' — ' + ed.degree : ''}`);
        const range = [ed.start, ed.end].filter(Boolean).join(' – ');
        if (range) doc.font('Helvetica-Oblique').text(range);
        doc.font('Helvetica');
        if (ed.notes) doc.text(ed.notes);
        doc.moveDown(0.3);
      }
    }

    if (resume.skills?.length) {
      sectionHeading('Skills');
      doc.text(resume.skills.join(' · '));
    }

    if (resume.certifications?.length) {
      sectionHeading('Certifications');
      for (const c of resume.certifications) doc.text('• ' + c);
    }

    for (const sec of resume.other || []) {
      sectionHeading(sec.heading);
      for (const item of sec.items) doc.text('• ' + item);
    }

    doc.end();
  });
}
