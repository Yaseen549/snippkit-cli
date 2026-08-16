import { describe, it, expect } from 'vitest';
import { detectLanguage, isExcludedFile, parseFilePathModifier } from '../src/commands/push.js';

describe('Push Command Helpers', () => {
  it('detects language from file extensions correctly', () => {
    expect(detectLanguage('script.py')).toBe('Python');
    expect(detectLanguage('app.js')).toBe('JavaScript');
    expect(detectLanguage('component.tsx')).toBe('TypeScript / React');
    expect(detectLanguage('main.go')).toBe('Go');
    expect(detectLanguage('unknown.xyz')).toBe('Plain Text');
  });

  it('identifies sensitive/excluded files correctly', () => {
    expect(isExcludedFile('.env')).toBe(true);
    expect(isExcludedFile('.env.production')).toBe(true);
    expect(isExcludedFile('credentials.json')).toBe(true);
    expect(isExcludedFile('secret.key')).toBe(true);
    expect(isExcludedFile('id_rsa')).toBe(true);
    expect(isExcludedFile('node_modules')).toBe(true);
    expect(isExcludedFile('.git')).toBe(true);

    expect(isExcludedFile('hello.py')).toBe(false);
    expect(isExcludedFile('app.js')).toBe(false);
  });

  it('parses inline per-file visibility, language, title, and slug modifiers correctly', () => {
    expect(parseFilePathModifier('file1.py:private')).toEqual({ filepath: 'file1.py', visibilityOverride: 'private', languageOverride: null, titleOverride: null, slugOverride: null });
    expect(parseFilePathModifier('file2.js:public')).toEqual({ filepath: 'file2.js', visibilityOverride: 'public', languageOverride: null, titleOverride: null, slugOverride: null });
    expect(parseFilePathModifier('file3.txt:language=python')).toEqual({ filepath: 'file3.txt', visibilityOverride: null, languageOverride: 'python', titleOverride: null, slugOverride: null });
    expect(parseFilePathModifier('file4.txt:public:lang=javascript:title=My Tool:slug=my-tool-slug')).toEqual({
      filepath: 'file4.txt',
      visibilityOverride: 'public',
      languageOverride: 'javascript',
      titleOverride: 'My Tool',
      slugOverride: 'my-tool-slug'
    });
    expect(parseFilePathModifier('file5.go')).toEqual({ filepath: 'file5.go', visibilityOverride: null, languageOverride: null, titleOverride: null, slugOverride: null });
  });
});
