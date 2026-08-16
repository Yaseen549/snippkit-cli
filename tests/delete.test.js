import { describe, it, expect, vi } from 'vitest';
import { deleteItem } from '../src/commands/manage.js';
import apiClient from '../src/lib/api.js';

describe('Safe Ambiguous Delete Logic', () => {
  it('handles explicit snippet deletion without cross-resource ambiguity check', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { id: 'uuid-1', slug: 'hello', title: 'Hello Snippet', language: 'python', is_public: false }
    });

    await deleteItem('hello', { snippet: true, yes: true });

    expect(getSpy).toHaveBeenCalledWith('/api/cli/run?id=hello&type=snippets');
    expect(postSpy).toHaveBeenCalledWith('/api/cli/delete', { id: 'uuid-1', type: 'snippets' });

    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('handles explicit command deletion without cross-resource ambiguity check', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { id: 'uuid-2', slug: 'hello', title: 'Hello Playbook', commands: ['echo hi'], is_public: false }
    });

    await deleteItem('hello', { command: true, yes: true });

    expect(getSpy).toHaveBeenCalledWith('/api/cli/run?id=hello&type=commands');
    expect(postSpy).toHaveBeenCalledWith('/api/cli/delete', { id: 'uuid-2', type: 'commands' });

    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('refuses non-interactive --yes deletion if slug matches BOTH snippet and command playbook', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.includes('type=snippets')) {
        return Promise.resolve({ data: { id: 'uuid-s', slug: 'hello', title: 'Hello Snippet' } });
      }
      if (url.includes('type=commands')) {
        return Promise.resolve({ data: { id: 'uuid-c', slug: 'hello', title: 'Hello Command' } });
      }
      return Promise.reject(new Error('Not found'));
    });

    // Should abort deletion and NOT call post /api/cli/delete
    await deleteItem('hello', { yes: true });

    expect(postSpy).not.toHaveBeenCalled();

    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('automatically resolves top-level delete when ONLY snippet exists', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.includes('type=snippets')) {
        return Promise.resolve({ data: { id: 'uuid-s1', slug: 'unique-snippet', title: 'Unique Snippet' } });
      }
      return Promise.reject(new Error('Not found'));
    });

    await deleteItem('unique-snippet', { yes: true });

    expect(postSpy).toHaveBeenCalledWith('/api/cli/delete', { id: 'uuid-s1', type: 'snippets' });

    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('automatically resolves top-level delete when ONLY command playbook exists', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.includes('type=commands')) {
        return Promise.resolve({ data: { id: 'uuid-c1', slug: 'unique-command', title: 'Unique Command' } });
      }
      return Promise.reject(new Error('Not found'));
    });

    await deleteItem('unique-command', { yes: true });

    expect(postSpy).toHaveBeenCalledWith('/api/cli/delete', { id: 'uuid-c1', type: 'commands' });

    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('safely handles nonexistent identifier without calling delete endpoint', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Not found'));

    await deleteItem('nonexistent-id-12345', { yes: true });

    expect(postSpy).not.toHaveBeenCalled();

    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('supports deleting multiple target IDs sequentially', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.includes('id=snip-1')) {
        return Promise.resolve({ data: { id: 'uuid-1', slug: 'snip-1', title: 'Snippet 1' } });
      }
      if (url.includes('id=snip-2')) {
        return Promise.resolve({ data: { id: 'uuid-2', slug: 'snip-2', title: 'Snippet 2' } });
      }
      return Promise.reject(new Error('Not found'));
    });

    await deleteItem(['snip-1', 'snip-2'], { snippet: true, yes: true });

    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(postSpy).toHaveBeenNthCalledWith(1, '/api/cli/delete', { id: 'uuid-1', type: 'snippets' });
    expect(postSpy).toHaveBeenNthCalledWith(2, '/api/cli/delete', { id: 'uuid-2', type: 'snippets' });

    postSpy.mockRestore();
    getSpy.mockRestore();
  });
});
