export const setHeaderHeight = () => {
	const header = document.querySelector('header');
	if (header) {
		const height = header.offsetHeight;
		document.documentElement.style.setProperty(
			'--header-height',
			`${height}px`,
		);
	}
};
