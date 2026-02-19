import { BrightDataModified } from '../nodes/BrightData/BrightDataModified.node';

describe('BrightDataModified', () => {
  let node: BrightDataModified;

  beforeEach(() => {
    node = new BrightDataModified();
  });

  it('should be defined', () => {
		expect(node).toBeDefined();
	});

	it('should have the correct properties', () => {
		expect(node.description).toBeDefined();
		expect(node.description.displayName).toBe('BrightDataModified');
		expect(node.description.name).toBe('brightDataModified');
		expect(node.description.icon).toBe('file:brightdatasquared.svg');
		expect(node.description.group).toEqual(["transform"]);
		expect(node.description.version).toBe(1);
	});
});
