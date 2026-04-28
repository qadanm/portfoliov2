// Education appears identically on every resume angle. If we ever need
// angle-specific phrasing (e.g. emphasizing the engineering bootcamp on
// engineer-leaning angles), add a `serves` array per entry and filter
// in engine.selectEducation. Until then, keep this dumb and listed in
// reverse-chronological order.

export interface EducationEntry {
  institution: string;
  /** The degree / program name as it should read on the resume. */
  degree: string;
  /** Optional annotation appended to the institution line. */
  type?: string;
  /** Free-form date range, e.g. "Aug 2019 – Dec 2019". */
  period: string;
  location?: string;
}

export const education: EducationEntry[] = [
  {
    institution: 'General Assembly',
    degree: 'Full Stack Software Engineering',
    type: 'Internship',
    period: 'Aug 2019 – Dec 2019',
    location: 'Santa Monica, CA',
  },
  {
    institution: 'Portland State University',
    degree: 'Associate’s, Human-Computer Interaction',
    period: 'Aug 2015 – Jul 2018',
  },
];
