import { describe, it, expect } from 'vitest';
import { MermaidRenderer } from '../src/media/mermaid';

describe('MermaidRenderer', () => {
  const renderer = new MermaidRenderer();

  it('correctly quotes unquoted node labels with special characters', () => {
    const rawCode = `
graph TD
  A[Draft & Review] --> B{Valid (Yes/No)?}
  C["Already Quoted & Safe"]
`;
    const sanitized = renderer.sanitizeMermaid(rawCode);
    expect(sanitized).toContain('["Draft & Review"]');
    expect(sanitized).toContain('{"Valid (Yes/No)?"}');
    expect(sanitized).toContain('["Already Quoted & Safe"]');
  });

  it('generates consistent hashes for identical code', () => {
    const code1 = 'graph TD\n  A --> B';
    const code2 = '  graph TD\n  A --> B  ';
    expect(renderer.getHash(code1)).toBe(renderer.getHash(code2));
  });

  it('generates png target paths inside the designated temp dir', () => {
    const hash = 'abc12345';
    const targetPath = renderer.getTargetPath(hash);
    expect(targetPath).toMatch(/abc12345\.png$/);
  });
});
