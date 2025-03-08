import { render } from '@testing-library/react';
import ClientOnly from '../ClientOnly';

describe('ClientOnly', () => {
	it('should render children after mounting', () => {
		const { container } = render(
			<ClientOnly>
				<div>Test Content</div>
			</ClientOnly>,
		);

		expect(container.innerHTML).toBe('<div>Test Content</div>');
	});

	it('should handle multiple children', () => {
		const { container } = render(
			<ClientOnly>
				<div>First Child</div>
				<span>Second Child</span>
			</ClientOnly>,
		);

		expect(container.innerHTML).toBe(
			'<div>First Child</div><span>Second Child</span>',
		);
	});

	it('should handle null children', () => {
		const { container } = render(<ClientOnly>{null}</ClientOnly>);

		expect(container.innerHTML).toBe('');
	});
});
