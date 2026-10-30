import { describe, expect, it, vi, beforeEach } from 'vitest';
import { addGroceryItem, getGroceryList, DEFAULT_PROFILE } from './api';

describe('Grocery pipeline API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds items and dispatches update event in browser environment', async () => {
    let eventFired = false;
    const dummyWindow = {
      dispatchEvent: () => {
        eventFired = true;
        return true;
      },
    };
    (globalThis as unknown as { window?: unknown }).window = dummyWindow;

    const mockItem = {
      id: 'g-new-1',
      name: 'Cucumber (Shosha)',
      category: 'Produce',
      price: 50,
      checked: false,
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/grocery/items')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(mockItem),
        });
      }
      if (url.includes('/api/grocery?budget=')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              budget: 500,
              groups: [{ category: 'Produce', items: [mockItem] }],
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    }) as unknown as typeof fetch;

    const item = await addGroceryItem('Produce', 'Cucumber (Shosha)', 50);
    expect(item.name).toBe('Cucumber (Shosha)');
    expect(item.category).toBe('Produce');
    expect(item.price).toBe(50);
    expect(eventFired).toBe(true);

    const list = await getGroceryList(DEFAULT_PROFILE);
    const produceGroup = list.groups.find((g) => g.category === 'Produce');
    expect(produceGroup).toBeDefined();
    const found = produceGroup?.items.find((i) => i.name === 'Cucumber (Shosha)');
    expect(found).toBeDefined();
    expect(found?.price).toBe(50);

    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('sends category and price to backend API', async () => {
    const mockItem = {
      id: 'g-new-2',
      name: 'Brown rice (Lal chal)',
      category: 'Grains & staples',
      price: 90,
      checked: false,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockItem),
    }) as unknown as typeof fetch;

    const item = await addGroceryItem('Grains & staples', 'Brown rice (Lal chal)', 90);
    expect(item.category).toBe('Grains & staples');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/grocery/items'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ category: 'Grains & staples', name: 'Brown rice (Lal chal)', price: 90 }),
      }),
    );
  });
});
