import { useMemo } from 'react';
import { Theme, applyTheme } from '../app/styles';

/**
 * Hook to access theme based on current dark/light mode
 * @param isDarkMode Boolean to determine if dark mode is active
 * @returns Object containing theme
 */
export const useThemeStyles = (isDarkMode: boolean) => {
	const theme = useMemo(() => applyTheme(isDarkMode), [isDarkMode]);

	return {
		theme,
	};
};

/**
 * Utility function to combine Tailwind classes
 * @param classes Array of class strings or conditionals
 * @returns Combined class string
 */
export const classNames = (...classes: (string | boolean | undefined)[]) => {
	return classes.filter(Boolean).join(' ');
};
