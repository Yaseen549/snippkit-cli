import { describe, it, expect } from 'vitest';
import { RUNNERS, EXTENSIONS } from '../src/commands/run.js';

describe('Run Command Mappings', () => {
  it('maps language to runner executables correctly', () => {
    expect(RUNNERS['python']).toBe('python');
    expect(RUNNERS['javascript']).toBe('node');
    expect(RUNNERS['typescript']).toBe('npx ts-node');
    expect(RUNNERS['go']).toBe('go run');
    expect(RUNNERS['java']).toBe('java');
    expect(RUNNERS['powershell']).toBe('pwsh');
  });

  it('maps language to file extensions correctly', () => {
    expect(EXTENSIONS['python']).toBe('py');
    expect(EXTENSIONS['javascript']).toBe('js');
    expect(EXTENSIONS['typescript']).toBe('ts');
    expect(EXTENSIONS['go']).toBe('go');
    expect(EXTENSIONS['java']).toBe('java');
    expect(EXTENSIONS['powershell']).toBe('ps1');
  });
});
