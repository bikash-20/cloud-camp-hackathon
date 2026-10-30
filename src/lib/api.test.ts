import { describe, expect, it } from 'vitest';
import { addGroceryItem, getGroceryList } from './api';
import { MOCK_PROFILE } from '../mocks/fixtures';

describe('Grocery pipeline API', () => {
  it('adds items with proper category buckets and dispatches update event in browser environment', async () => {
    let eventFired = false;
    const dummyWindow = {
      dispatchEvent: () => {
        eventFired = true;
        return true;
      },
    };
    (globalThis as unknown as { window?: unknown }).window = dummyWindow;

    const item = await addGroceryItem('Produce', 'Cucumber (Shosha)', 50);
    expect(item.name).toBe('Cucumber (Shosha)');
    expect(item.category).toBe('Produce');
    expect(item.price).toBe(50);
    expect(eventFired).toBe(true);

    const list = await getGroceryList(MOCK_PROFILE);
    const produceGroup = list.groups.find((g) => g.category === 'Produce');
    expect(produceGroup).toBeDefined();
    const found = produceGroup?.items.find((i) => i.name === 'Cucumber (Shosha)');
    expect(found).toBeDefined();
    expect(found?.price).toBe(50);

    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('normalizes category strings like grains or staples', async () => {
    const item = await addGroceryItem('Grains & staples', 'Brown rice (Lal chal)', 90);
    expect(item.category).toBe('Grains & staples');

    const list = await getGroceryList(MOCK_PROFILE);
    const grainsGroup = list.groups.find((g) => g.category === 'Grains & staples');
    expect(grainsGroup?.items.some((i) => i.name === 'Brown rice (Lal chal)')).toBe(true);
  });
});

