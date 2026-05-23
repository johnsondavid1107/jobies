import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx';
import { ResumeSections } from '@/lib/ai/prompts';

function h1(t: string) {
  return new Paragraph({
    children: [new TextRun({ text: t, bold: true, size: 32 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  });
}
function h2(t: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 22 })],
    spacing: { before: 200, after: 80 },
  });
}
function p(text: string, opts: { bold?: boolean; italics?: boolean } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics })],
    spacing: { after: 60 },
  });
}
function bullet(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

export async function renderResumeDocx(resume: ResumeSections): Promise<Buffer> {
  const children: Paragraph[] = [];

  const header = resume.header || {};
  if (header.name) children.push(h1(header.name));
  const contactLine = [header.email, header.phone, header.location, ...(header.links || [])]
    .filter(Boolean)
    .join(' · ');
  if (contactLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactLine, size: 18 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  }

  if (resume.summary) {
    children.push(h2('Summary'));
    children.push(p(resume.summary));
  }

  if (resume.experience && resume.experience.length) {
    children.push(h2('Experience'));
    for (const e of resume.experience) {
      const head = `${e.title} — ${e.company}${e.location ? ', ' + e.location : ''}`;
      children.push(p(head, { bold: true }));
      const range = [e.start, e.end].filter(Boolean).join(' – ');
      if (range) children.push(p(range, { italics: true }));
      for (const b of e.bullets || []) children.push(bullet(b));
    }
  }

  if (resume.projects && resume.projects.length) {
    children.push(h2('Projects'));
    for (const pr of resume.projects) {
      children.push(p(pr.name, { bold: true }));
      if (pr.description) children.push(p(pr.description));
      for (const b of pr.bullets || []) children.push(bullet(b));
    }
  }

  if (resume.education && resume.education.length) {
    children.push(h2('Education'));
    for (const ed of resume.education) {
      const line = `${ed.school}${ed.degree ? ' — ' + ed.degree : ''}`;
      children.push(p(line, { bold: true }));
      const range = [ed.start, ed.end].filter(Boolean).join(' – ');
      if (range) children.push(p(range, { italics: true }));
      if (ed.notes) children.push(p(ed.notes));
    }
  }

  if (resume.skills && resume.skills.length) {
    children.push(h2('Skills'));
    children.push(p(resume.skills.join(' · ')));
  }

  if (resume.certifications && resume.certifications.length) {
    children.push(h2('Certifications'));
    for (const c of resume.certifications) children.push(bullet(c));
  }

  for (const sec of resume.other || []) {
    children.push(h2(sec.heading));
    for (const item of sec.items) children.push(bullet(item));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
